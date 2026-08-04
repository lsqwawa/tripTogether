export default {
  // 仅对暂存文件做 Prettier 格式化（根 prettier 可用；ESLint 仅服务端在 CI 跑）
  "*.{ts,tsx,js,jsx,json,css,html,md}": ["prettier --write"],
};
