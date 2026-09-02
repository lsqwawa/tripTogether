import axios from "axios";

const client = axios.create({
  // API 基址：默认根路径 /api（8080 端口 /trip/ 前缀部署 + 根路径 API 时无需配置）；
  // 若 API 与页面同挂子路径（如 80 端口 /trip-api/ 布局），构建时用 VITE_API_BASE_URL 覆盖。
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15000,
});

// 请求拦截：携带 JWT
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截：401（未登录/登录过期）清理 token 并跳登录
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userInfo");
      // 登录页在子路径前缀下（如 /trip/login），不能写死根路径 /login
      const loginPath = `${import.meta.env.BASE_URL}login`;
      if (window.location.pathname !== loginPath) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  }
);

export default client;
