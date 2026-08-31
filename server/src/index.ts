import "reflect-metadata";
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { AppDataSource } from "./database";
import { authenticate } from "./middleware/auth";
import tripRoutes from "./routes/tripRoutes";
import planRoutes from "./routes/planRoutes";
import userRoutes from "./routes/userRoutes";
import expenseRoutes from "./routes/expenseRoutes";
import shareRoutes from "./routes/shareRoutes";
import transportLookupRoutes from "./routes/transportLookup";
import uploadRoutes from "./routes/uploadRoutes";

const app = express();
const PORT = process.env.PORT || 3001;

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
