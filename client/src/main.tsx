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
