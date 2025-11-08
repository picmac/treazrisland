import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      supertest: resolve(__dirname, "src/test/supertestShim.ts"),
      nodemailer: resolve(__dirname, "src/test/nodemailerStub.ts")
    }
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setupEnv.ts"],
    coverage: {
      enabled: false
    }
  }
});
