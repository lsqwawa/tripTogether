import "reflect-metadata";
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { AppDataSource } from "./database";
import { authenticate } from "./middleware/auth";
import { rateLimit } from "./middleware/rateLimit";
import tripRoutes from "./routes/tripRoutes";
import planRoutes from "./routes/planRoutes";
import userRoutes from "./routes/userRoutes";
import expenseRoutes from "./routes/expenseRoutes";
import shareRoutes from "./routes/shareRoutes";
import transportLookupRoutes from "./routes/transportLookup";
import transportMatchRoutes from "./routes/transportMatchRoutes";
import checklistRoutes from "./routes/checklistRoutes";
import weatherRoutes from "./routes/weatherRoutes";
import uploadRoutes from "./routes/uploadRoutes";

const app = express();
const PORT = process.env.PORT || 3001;

// 反向代理后 req.ip 才是真实客户端 IP，否则限流会把所有用户算进同一个桶。
// 仅在显式配置 TRUST_PROXY 时启用（直连暴露会允许伪造 X-Forwarded-For）：
// 单级 nginx 填 1，多级代理填跳数。
if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY;
  app.set("trust proxy", v === "true" ? true : Number.isNaN(Number(v)) ? v : Number(v));
}

app.use(cors());
app.use(express.json());

// 静态文件服务（数据库目录）
app.use("/data", express.static(path.join(__dirname, "../data")));

// 公开：邀请链接只读查看（免登录）
app.use("/api/trips/share", shareRoutes);

// 注册/登录公开；/me 等受保护在 userRoutes 内部
app.use("/api/users", userRoutes);

// 以下路由组均需登录（Bearer Token）
app.use("/api/trips", authenticate, tripRoutes);
app.use("/api/trips/:tripId", authenticate, planRoutes);
app.use("/api/trips/:tripId/expenses", authenticate, expenseRoutes);
app.use("/api/trips/:tripId", authenticate, transportMatchRoutes);
app.use("/api/trips/:tripId/checklist", authenticate, checklistRoutes);

// 天气代理：需登录（避免成为匿名出站代理被滥用），按 IP 限流
app.use(
  "/api/weather",
  authenticate,
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyPrefix: "weather:",
    message: "天气请求过于频繁，请稍后再试",
  }),
  weatherRoutes
);

// 交通班次查询代理（航班/火车）：登录即可用
app.use("/api/transport-lookup", transportLookupRoutes);

// 图片上传（登录即可用，内部已挂 authenticate）
app.use("/api/upload", uploadRoutes);

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 全局错误兜底：避免未捕获异常导致 500 + 堆栈泄露给客户端
app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction
  ) => {
    console.error("[Unhandled Error]", err);
    const isProd = process.env.NODE_ENV === "production";
    const status = err.status || 500;
    res.status(status).json({
      error: isProd ? "服务器内部错误" : err.message || "服务器内部错误",
    });
  }
);

// 启动服务
async function bootstrap() {
  await AppDataSource.initialize();
  console.log("数据库已连接");

  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("启动失败:", err);
});
