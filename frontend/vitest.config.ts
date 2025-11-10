import type { UserConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const resolveFromRoot = (relativePath: string) => path.resolve(rootDir, relativePath);

const config: UserConfig = {
  resolve: {
    alias: {
      "@": resolveFromRoot("./"),
      "@/src": resolveFromRoot("./src"),
      "@lib": resolveFromRoot("./src/lib"),
      "@components": resolveFromRoot("./src/components"),
      "@auth": resolveFromRoot("./src/auth"),
      "@onboarding": resolveFromRoot("./src/onboarding"),
      "@admin": resolveFromRoot("./src/admin")
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "app/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "__tests__/**/*.test.{ts,tsx}"
    ]
  }
};

export default config;
