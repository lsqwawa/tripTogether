-- =============================================================================
-- TripTogether 数据库初始化 / 更新脚本 (PostgreSQL)
-- =============================================================================
-- 作用：
--   1. 在其它电脑上一键创建数据库 trip_together 与全部数据表；
--   2. 重复执行安全（CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS），
--      只会补齐缺失的表或字段，不会清空已有数据；
--   3. 与 server/src/database.ts 中的 synchronize:true 配合：首次用本脚本建库建表，
--      之后若修改了实体，重新跑本脚本 + 重启服务即可（synchronize 会自动补齐差异）。
--
-- 用法（需要 PostgreSQL 客户端 psql）：
--   psql -U postgres -d postgres -f server/init.sql
--   或带密码：
--   PGPASSWORD=你的密码 psql -U postgres -d postgres -h localhost -p 5432 -f server/init.sql
--
-- 说明：
--   - 默认数据库名 trip_together、超级用户 postgres；如要改名，连同
--     server/src/database.ts 一起改。
--   - CREATE DATABASE 不能放在事务里，本脚本用 \gexec 技巧实现“不存在才建库”。
--   - 建库需要建库权限（postgres 超级用户默认具备）。
-- =============================================================================

-- 1) 若数据库不存在则创建（在 postgres 维护库下执行）
SELECT 'CREATE DATABASE trip_together'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'trip_together')\gexec

-- 2) 切换到业务库，后续所有语句都在此库执行
\c trip_together

-- 3) uuid 主键默认值依赖 uuid-ossp 扩展（TypeORM 用 uuid_generate_v4()）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 4) 数据表（按依赖顺序创建，外键内联；已存在则跳过）
-- =============================================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nickname    varchar(50)  NOT NULL,
  avatar      varchar,
  password    varchar,
  "createdAt" timestamp    NOT NULL DEFAULT now()
);

-- 旅行计划表
CREATE TABLE IF NOT EXISTS trips (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        varchar(100) NOT NULL,
  description  text,
  "startDate"  date         NOT NULL,
  "endDate"    date         NOT NULL,
  "coverImage" varchar,
  status       varchar      NOT NULL DEFAULT 'planning',
  "inviteCode" varchar(12)  NOT NULL UNIQUE,
  destination  varchar,
  "budgetTotal" double precision,
  "createdAt"  timestamp    NOT NULL DEFAULT now()
);

-- 计划成员表（谁参与了哪个计划、角色）
CREATE TABLE IF NOT EXISTS trip_members (
  id       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tripId" uuid         NOT NULL REFERENCES trips(id)   ON DELETE CASCADE,
  "userId" uuid         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role     varchar      NOT NULL DEFAULT 'editor',
  "joinedAt" timestamp  NOT NULL DEFAULT now()
);

-- 城际/出发/返程交通
CREATE TABLE IF NOT EXISTS transportations (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tripId"       uuid    NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type           varchar NOT NULL,                       -- departure | return | intercity
  "transportType" varchar NOT NULL,                      -- flight | train | bus | car | ship | other
  "departurePlace" varchar,
  "arrivalPlace"   varchar,
  "departureTime" timestamp,
  "arrivalTime"   timestamp,
  status         varchar NOT NULL DEFAULT 'pending',
  "bookingInfo"  text,
  notes          text,
  cost           double precision,
  "depLat"       double precision,
  "depLng"       double precision,
  "arrLat"       double precision,
  "arrLng"       double precision
);

-- 住宿
CREATE TABLE IF NOT EXISTS accommodations (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tripId"     uuid    NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name         varchar NOT NULL,
  address      varchar,
  "checkInDate"  date   NOT NULL,
  "checkOutDate" date   NOT NULL,
  status       varchar NOT NULL DEFAULT 'pending',
  "bookingInfo" text,
  notes        text,
  cost         double precision,
  lat          double precision,
  lng          double precision
);

-- 每日日程（按天）
CREATE TABLE IF NOT EXISTS daily_schedules (
  id        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tripId"  uuid    NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  "dayIndex" integer NOT NULL,
  date      date    NOT NULL,
  title     varchar
);

-- 日程项（一天内的具体安排；scheduleId 关联所属天，tripId 冗余便于查询）
CREATE TABLE IF NOT EXISTS schedule_items (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "scheduleId"     uuid    NOT NULL REFERENCES daily_schedules(id) ON DELETE CASCADE,
  "tripId"         varchar NOT NULL,                          -- 冗余字段，无外键
  "sortOrder"      integer NOT NULL,
  type             varchar NOT NULL,
  title            varchar(100) NOT NULL,
  description      text,
  "locationName"   varchar,
  address          varchar,
  lat              double precision,
  lng              double precision,
  "startTime"      time,
  "endTime"        time,
  cost             double precision,
  notes            text,
  "imageUrl"       varchar,
  "transportToNext" varchar,
  status           varchar NOT NULL DEFAULT 'pending',
  "version"        integer NOT NULL DEFAULT 1                 -- 乐观锁：编辑冲突检测(8.2)
);

-- 花费 / 记账
CREATE TABLE IF NOT EXISTS expenses (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tripId"       uuid    NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title          varchar(100) NOT NULL,
  category       varchar NOT NULL DEFAULT 'other',          -- food | transport | lodging | ticket | shopping | other
  amount         double precision NOT NULL,
  "payerId"      varchar NOT NULL,                          -- 谁付的钱
  "participantIds" text   NOT NULL DEFAULT '[]',            -- 参与分摊的 userId 列表(JSON)
  "expenseDate"  date,
  notes          text,
  "createdAt"    timestamp NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5) 常用索引（提升按计划/成员/天查询的性能；已存在则跳过）
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_trip_members_trip   ON trip_members("tripId");
CREATE INDEX IF NOT EXISTS idx_trip_members_user   ON trip_members("userId");
CREATE INDEX IF NOT EXISTS idx_transportations_trip ON transportations("tripId");
CREATE INDEX IF NOT EXISTS idx_accommodations_trip ON accommodations("tripId");
CREATE INDEX IF NOT EXISTS idx_daily_schedules_trip ON daily_schedules("tripId");
CREATE INDEX IF NOT EXISTS idx_schedule_items_sched ON schedule_items("scheduleId");
CREATE INDEX IF NOT EXISTS idx_schedule_items_trip  ON schedule_items("tripId");
CREATE INDEX IF NOT EXISTS idx_expenses_trip        ON expenses("tripId");

-- =============================================================================
-- 6) 增量更新区（schema 变更时在此追加，保持 IF NOT EXISTS 使其可重复执行）
--    例：将来给 expenses 加 currency 字段
--    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency varchar DEFAULT 'CNY';
-- -----------------------------------------------------------------------------
-- 2026-08-05 追加：schedule_items 增加乐观锁 version 列（8.2 编辑冲突检测）。
-- 已存在的库重跑本脚本时，CREATE TABLE 不会改已有表，故用 ALTER 补齐。
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
-- -----------------------------------------------------------------------------
-- 2026-08-28 追加：transportations 增加城际交通两端坐标（6.10 跨城连线）。
ALTER TABLE transportations ADD COLUMN IF NOT EXISTS "depLat" double precision;
ALTER TABLE transportations ADD COLUMN IF NOT EXISTS "depLng" double precision;
ALTER TABLE transportations ADD COLUMN IF NOT EXISTS "arrLat" double precision;
ALTER TABLE transportations ADD COLUMN IF NOT EXISTS "arrLng" double precision;
-- =============================================================================

-- 完成提示
DO $$
BEGIN
  RAISE NOTICE 'TripTogether 数据库初始化/更新完成 ✅';
END $$;
