# TripTogether 🧭

> 多人协作旅游规划平台 · Web 优先

和旅伴一起规划下一段旅程：进度看板追踪每个规划环节的完成状态、一条分享链接就能让任何人免注册查看、地图路线总览把所有地点串起来。

---

## ✨ 核心特性

- **零门槛协作** — 生成 8 位邀请码 / 分享链接，任何人点开即可免注册只读查看计划
- **进度看板** — 出发交通 🚀 / 住宿安排 🏨 / 每日日程 📅 / 返程交通 🏠 四个环节，状态一目了然（待规划 → 已预订 → 已确认）
- **每日日程** — 按天排布，支持美食 / 景点 / 活动 / 交通 / 休息 5 类，可拖拽排序、标记完成
- **交通与住宿** — 飞机 / 火车 / 大巴 / 自驾 / 轮船 / 城际，含班次、时间、费用、预订信息；住宿含入离日期与费用
- **花费管理** — 按分类记录（餐饮 / 交通 / 住宿 / 门票 / 购物 / 其他），自动计算总花费与**人均**，点击查看**按人明细**（谁付款、应摊、净额）
- **地图路线总览** — 基于 Leaflet 标注所有地点，按天分色连线，直观看整体路线
- **行程总览** — 一页导出所有安排、交通、日程、花费汇总和邀请码
- **用户系统** — 昵称 + 密码注册登录（SHA-256），个人中心可改昵称、看自己参与的计划、退出登录，登录态本地持久化
- **移动端适配** — 全站响应式，手机端单列布局 + 折叠导航，随时随地规划

---

## 🛠 技术栈

| 层级 | 选型 |
| --- | --- |
| 前端框架 | React 18 + TypeScript + Vite |
| UI 组件库 | Ant Design 5 |
| 状态管理 | Zustand |
| 拖拽 | @dnd-kit |
| 地图 | Leaflet + OpenStreetMap（无需 API Key） |
| 后端框架 | Express + TypeScript |
| ORM | TypeORM |
| 数据库 | PostgreSQL |
| 认证 | 昵称 + 密码（SHA-256 哈希 + localStorage 会话） |

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- PostgreSQL 12+

### 1. 数据库

需本地有 PostgreSQL 实例。连接配置通过环境变量提供（见 `server/.env`，模板见 `server/.env.example`），**密钥不写在代码里**：

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=你的密码
DB_NAME=trip_together
DB_SYNCHRONIZE=true   # 开发期 true（启动自动建/改表），生产建议 false
PORT=3001

# 腾讯地图 WebService Key（服务端用：地理编码 + 路线规划匹配引擎；需在控制台开通 WebService API）
TENCENT_MAP_KEY=
# 腾讯地图 JS API GL Key（前端用：地图渲染与路线规划；配置在 client/.env 的 VITE_TENCENT_MAP_KEY，未配置时前端回退内置默认 Key）
VITE_TENCENT_MAP_KEY=
```

> `.env` 含密钥，已被 `.gitignore` 忽略，不要提交。换机器部署时复制 `server/.env.example` 为 `server/.env` 并填入对应环境的真实值即可。
> 前端 Key：复制 `client/.env.example` 为 `client/.env` 并填入 `VITE_TENCENT_MAP_KEY`（可选，缺省回退内置值）。
> `server/src/database.ts` 通过 `dotenv` 读取上述变量，未设置时回退到默认值（localhost/postgres 等）。

### 1.1 一键初始化数据库（推荐）

项目提供了可移植的 SQL 脚本 `server/init.sql`，可在任意装有 PostgreSQL 的机器上**直接建库建表**，重复执行安全（只补缺失的表/字段，不丢数据）：

```bash
# 需 psql 客户端，以超级用户 postgres 执行（在 postgres 维护库下）
psql -U postgres -d postgres -f server/init.sql
# 或带密码：
PGPASSWORD=你的密码 psql -U postgres -d postgres -h localhost -p 5432 -f server/init.sql
```

脚本会自动：① 不存在则创建 `trip_together` 库；② 启用 `uuid-ossp` 扩展；③ 创建全部 8 张表与外键；④ 建立常用索引。若后续改了实体字段，重新跑一次即可补齐，配合 `synchronize: true` 也能自动对齐差异。

### 2. 安装依赖

```bash
# 在项目根目录安装根脚本依赖
npm install

# 安装前后端依赖（二选一）
npm run install:all
# 或分别安装
cd server && npm install
cd ../client && npm install
```

### 3. 启动开发服务

```bash
# 一键同时启动前后端
npm run dev
```

或分开启动：

```bash
# 终端 1：后端（默认 http://localhost:3001）
npm run dev:server

# 终端 2：前端（默认 http://localhost:5175，/api 已代理到后端 3001）
npm run dev:client
```

### 4. 访问

打开浏览器访问 **http://localhost:5175** 即可。

---

## 📁 项目结构

```
TripTogether/
├── client/                     # 前端（React + Vite）
│   ├── src/
│   │   ├── pages/              # 页面：Home / TripDetail / CreateTrip / Login / Profile / JoinTrip / ShareTrip / Guide
│   │   ├── components/         # 组件：AppLayout / ProgressBoard / ExpensesTab 等
│   │   ├── stores/             # Zustand 状态：userStore 等
│   │   ├── api/                # 接口封装（axios）
│   │   ├── types/              # 前后端共享类型定义
│   │   └── styles/global.css   # 全局 + 响应式样式
│   └── vite.config.ts          # 端口 5175，/api 代理到 3001
├── server/                     # 后端（Express + TypeORM）
│   └── src/
│       ├── entities/           # 实体：User / Trip / TripMember / Transportation / Accommodation / DailySchedule / ScheduleItem / Expense
│       ├── routes/             # 路由：trip / plan / user / expense 等
│       ├── middleware/         # 用户上下文中间件
│       ├── database.ts         # 数据库连接配置
│       └── index.ts            # 服务入口（端口 3001）
├── docs/                       # 产品分析与实施计划
└── 项目功能说明文档.md            # 功能实现对照表（含自测清单）
```

---

## 🔌 主要 API 端点

所有接口前缀为 `/api`。

### 用户 `users`
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/users/register` | 注册（昵称 + 密码） |
| POST | `/users/login` | 登录（昵称 + 密码） |
| GET  | `/users/me` | 获取当前用户信息 |
| PATCH | `/users/me` | 修改昵称 |
| GET  | `/users/me/trips` | 我参与的旅行 |

### 旅行计划 `trips`
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET / POST | `/trips` | 列表 / 创建 |
| GET / PATCH / DELETE | `/trips/:tripId` | 详情 / 编辑 / 删除 |
| POST | `/trips/join` | 用邀请码加入 |
| GET | `/trips/:tripId/plan` | 完整计划数据（含成员、交通、住宿、日程） |

### 花费 `trips/:tripId/expenses`
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET / POST | `/expenses` | 列表 / 新增 |
| GET / PATCH / DELETE | `/expenses/:id` | 详情 / 编辑 / 删除 |
| GET | `/expenses/stats` | 统计：总花费、人均、按人净额 |

> 前端调用后端接口时需在请求头带上 `x-user-id`（当前登录用户 ID），用于权限校验。

---

## 🔄 近期更新（2026-08-03）

- **首页样式修复**：用 CSS Grid 重写计划卡片布局，桌面 / 平板 / 手机三档自适应，不再错位
- **花费人均 / 按人统计**：新增 `Expense` 实体与费用路由，Trip 详情新增「花费」Tab —— 顶部统计卡（总花费 / 人均 / 参与成员 / 记录数），点击「人均」或「总花费」弹出按人明细 Modal
- **用户登录 / 个人中心**：新增注册登录页、个人中心页（头像、改昵称、退出、参与计划统计），Header 加用户入口，登录态本地持久化
- **移动端适配**：全站响应式，移动端折叠导航 + 单列卡片 + 全屏 Modal
- 详见 `项目功能说明文档.md` 的功能对照表与自测清单

---

## 📝 开发说明

- 后端使用 `tsx watch` 热重载；前端使用 Vite HMR。
- 数据库表随服务启动自动同步（TypeORM `synchronize`），无需手动迁移。
- 前端未挂载到独立进程时，可 `npm run build` 构建产物到 `client/dist/`。

---

## 📌 已知限制 / 后续规划

- 认证为 MVP 简化方案（昵称 + 密码 + 本地会话），后续计划接入 JWT / 微信扫码
- 实时协作（多人同时编辑）、评论、导出 PDF、预算对比尚未实现（已支持导出 PNG 长图分享）
- 生产部署建议：数据库配置改环境变量、接入对象存储做图片上传、地图瓦片在国内建议替换为腾讯地图

详见 `项目功能说明文档.md` 与 `docs/产品分析与实施计划.html`。
