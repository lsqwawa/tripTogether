# 交通班次查询对接说明（航班 / 火车）

> 功能：在行程的交通 Modal 中，选择「飞机」输入航班号 / 选择「火车」输入车次，
> 后端代理自动查询并返回班次信息，可一键「回填到表单」。
> 已实现并实测：后端 `GET /api/transport-lookup` + 前端 `TransportTab` 交互。

---

## 一、航班查询 —— Aviationstack（需免费 Key）

火车用官方接口免 key，但**航班必须有一个 Key**（Aviationstack 免费档）。

### 注册并获取 Key
1. 打开 <https://aviationstack.com/> ，点击右上角 **Sign Up Free**（免费档）。
2. 用邮箱 + 密码注册，去邮箱完成验证。
3. 登录后进入 **Dashboard**，复制页面上的 **API Access Key**（一串字母数字）。
4. 打开项目 `server/.env`，把 Key 填进去：
   ```env
   AVIATIONSTACK_KEY=你复制的key
   ```
5. **重启后端**（`npm run dev`）即可生效。

### 免费档限制（已知）
- 100 次请求 / 月，免费档限速 **1 次 / 60 秒**。
- 实时数据有 30~60 秒延迟；返回字段含计划/实际起降、状态、登机口、机型。
- **未配置 Key 时**：接口自动返回「演示 mock 数据」，前端交互仍可全程联调，不受影响。

---

## 二、火车查询 —— 12306 官方接口（免 Key、免注册）

✅ **无需任何配置，开箱即用。**

后端直接调用 12306 公开搜索接口：
`https://search.12306.cn/search/v1/train/search?keyword=<车次>&date=<YYYYMMDD>`
返回车次、始发站、终到站、停靠站数、日期等。

> 增强项「完整经停时刻表」走 `queryByTrainNo`，需要站名电报码；
> 部分日期/无会话 cookie 时可能返回空（已在代码里优雅降级，主信息始终可用）。

---

## 三、（可选）更稳的 12306 封装 —— apihz.cn

如果后续想要**余票、完整经停**且不在意注册，可改用第三方封装：
1. 打开 <https://www.apihz.cn/> 注册，进入「用户中心」拿到数字 **ID** 和通讯 **KEY**。
2. 余票：`https://cn.apihz.cn/api/12306/api.php?id=你的ID&key=你的KEY&add=出发&end=到达&y=2026&m=8&d=15`
3. 经停：`https://cn.apihz.cn/api/12306/api3.php?...&train_order=上一步返回的train_order`
> 注意：apihz 的余票接口需要出发站 + 到达站 + 日期，不像官方搜索接口能纯按车次号查，
> 因此当前实现默认用官方接口（更简单、免 key）。

---

## 四、如何验证功能已生效

1. 启动前后端，进入任意行程 → 交通 Tab → 添加 / 编辑一条交通。
2. 选「飞机」+ 预订信息填 `CA1234` → Modal 内出现航班信息卡（航司、起降、状态）+ 「回填到表单」按钮。
3. 选「火车」+ 预订信息填 `G1` → 出现车次信息（北京南 → 上海虹桥，停靠 7 站）。
4. 点「回填到表单」即可把起降地 / 时间写入表单，保存后卡片即展示真实班次信息。

---

## 五、配置位置速查

| 项目 | 位置 |
|---|---|
| 航班 Key | `server/.env` → `AVIATIONSTACK_KEY` |
| 后端代理逻辑 | `server/src/routes/transportLookup.ts` |
| 路由注册 | `server/src/index.ts`（`/api/transport-lookup`） |
| 前端 API 封装 | `client/src/api/index.ts` → `transportLookupApi` |
| 前端交互 | `client/src/pages/TripDetail.tsx` → `TransportTab` |
