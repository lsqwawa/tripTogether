import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
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
});
