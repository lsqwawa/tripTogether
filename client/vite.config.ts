import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base：部署在子域名根路径（http://trip.xnay.cc/），固定 "/"。
// 历史上曾用函数式按 mode 切 /trip/（8080 子路径部署），改为子域名后不再需要。
export default defineConfig({
  base: "/",
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
    // antd 组稳定在 1.1MB（gzip 约 340KB），是 antd 5 CSS-in-JS 全量组件的固有成本，
    // 拆不动了，故把告警阈值提到 1200 —— 一旦再有新依赖把某个 chunk 顶上去，告警仍会响。
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // 拆包：把体积大、更新频率低的第三方库按族拆成独立 chunk。
        // 收益一：改业务代码时这些 chunk 的 hash 不变，浏览器长期缓存持续命中；
        // 收益二：HTTP/2 下并行下载多个小文件，比单个 1.8MB 大包更快到首屏。
        // 关键约束（踩过的坑）见各分支注释，改错会出现 "Circular chunk" 告警。
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          // 1) React 运行时。只放 react/react-dom/scheduler 这三个「零外部依赖」的包。
          //    ⚠️ 不能把 react-router 放进来：它依赖 @remix-run/router（会落到 vendor），
          //    两者互相引用即构成 vendor ↔ react-vendor 循环 chunk。
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react-vendor";

          // 2) antd 及其 rc-* / @rc-component / @ant-design/* 依赖必须**同组**。
          //    ⚠️ 试过把 @ant-design/icons 单独拆出来，结果报 antd-icons → antd → antd-icons 循环：
          //    icons 依赖 rc-util，而 rc-util 属 antd 组，双向引用。收益也只有 50KB，不值得，故合并。
          if (/[\\/]node_modules[\\/](antd|@ant-design|@rc-component|rc-[^\\/]+)[\\/]/.test(id)) return "antd";

          // 3) antd-mobile 独立成组（移动端弹层组件）
          if (/[\\/]node_modules[\\/]antd-mobile[\\/]/.test(id)) return "antd-mobile";

          // 4) 拖拽库
          if (/[\\/]node_modules[\\/]@dnd-kit[\\/]/.test(id)) return "dnd-kit";

          // 5) 导出长图用的重库
          if (/[\\/]node_modules[\\/]html2canvas[\\/]/.test(id)) return "html2canvas";

          // 6) 其余（react-router、axios、zustand、dayjs 等）合并，避免碎片化
          return "vendor";
        },
      },
    },
  },
});
