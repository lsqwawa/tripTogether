import axios from "axios";

const client = axios.create({
  baseURL: "/api",
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
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default client;
