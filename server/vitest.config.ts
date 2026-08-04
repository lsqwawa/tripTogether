import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // 单测不连真实库；auth 工具需 JWT_SECRET，这里注入测试值
    env: {
      JWT_SECRET: "test-secret-for-vitest-0123456789",
      JWT_EXPIRES_IN: "1h",
    },
  },
});
