import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      supertest: resolve(__dirname, "src/test/supertestShim.ts"),
      "supertest-real": resolve(__dirname, "node_modules/supertest/index.js"),
      postmark: resolve(__dirname, "src/test/postmarkStub.ts")
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
