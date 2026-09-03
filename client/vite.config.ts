import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base：生产构建走子路径 /trip/（部署在共享服务器 8080 端口的 /trip/ 前缀下）；
// 本地 dev（mode=development）保持根路径，开发习惯不变。
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/trip/" : "/",
  plugins: [react()],
  server: {
    port: 5175,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/data": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    // 关闭自动清空输出目录：Windows 下 vite 清空 dist 会触发回收站安全删除而报错，
    // 改为构建前用 rm -rf 手动清空（见 npm run build 前置命令）。
    emptyOutDir: false,
  },
}));
