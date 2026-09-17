import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import "dayjs/locale/zh-cn";
import App from "./App";
import "./styles/global.css";
// antd-mobile 移动端组件样式（日期/日历选择器底部弹起）
import "antd-mobile/bundle/style.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 8,
        },
      }}
    >
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AntApp>
          <App />
        </AntApp>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);

// 首屏启动动画（#splash，样式与结构全部内联在 index.html）：
// 等首帧真正绘制完成 + 满足最短展示时长后再淡出移除，避免「闪一下就没」的观感。
// performance.now() 即「距导航开始」的毫秒数，正好等于启动动画已展示的时长。
// index.html 的 CSS 里另有 5s 兜底自动隐藏，防止本段逻辑异常时启动动画一直盖住页面。
const SPLASH_MIN_MS = 700;
const SPLASH_FADE_MS = 300;

function dismissSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.classList.add("splash-hidden");
  window.setTimeout(() => splash.remove(), SPLASH_FADE_MS);
}

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.setTimeout(
      dismissSplash,
      Math.max(0, SPLASH_MIN_MS - performance.now())
    );
  });
});
