import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      NETPLAY_BASE_URL: "http://localhost:4800",
      NETPLAY_API_KEY: "test-key"
    },
    coverage: {
      enabled: false
    }
  }
});
