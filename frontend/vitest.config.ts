import type { UserConfig } from "vitest/config";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const resolveFromRoot = (relativePath: string) => path.resolve(rootDir, relativePath);

const cpuCount = os.availableParallelism?.() ?? os.cpus().length ?? 1;
const maxWorkers = Math.max(1, Math.min(cpuCount, 4));

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
    maxWorkers,
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
