import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("promtail log shipping configuration", () => {
  it("targets Loki and preserves structured fields", async () => {
    const repoRoot = resolve(__dirname, "../../..");
    const configPath = resolve(repoRoot, "infra", "monitoring", "promtail-config.yml");
    const contents = await readFile(configPath, "utf8");

    expect(contents).toMatch(/clients:\s*\n\s*- url: http:\/\/loki:3100\/loki\/api\/v1\/push/);
    expect(contents).toMatch(/job_name:\s+docker/);
    expect(contents).toMatch(/pipeline_stages:/);
    expect(contents).toMatch(/json:\s*\n\s*expressions:/);
    expect(contents).toMatch(/labels:\s*\n\s*level:/);
  });
});
