import { describe, expect, it } from "vitest";

import {
  ARG_ALIASES,
  gatherRotationInput,
  parseArgs,
  resolveInput,
  runRotation,
} from "./rotate-screenscraper-credentials.js";

describe("ScreenScraper rotation tooling", () => {
  it("parses CLI flags into rotation input", () => {
    const argv = ["--username=pirate", "--password=secret", "--dev-id=abc", "--dev-password=xyz", "--secret-key=key"];
    const parsed = parseArgs(argv);

    for (const alias of Object.keys(ARG_ALIASES)) {
      if (parsed[alias]) {
        expect(parsed[alias]).toBeDefined();
      }
    }

    const resolved = resolveInput(parsed);
    expect(resolved).toMatchObject({
      username: "pirate",
      password: "secret",
      developerId: "abc",
      developerPassword: "xyz",
      secretKey: "key",
    });
  });

  it("throws when the encryption secret is missing", () => {
    expect(() => resolveInput({})).toThrow(/Missing encryption secret/);
  });

  it("collects prompts when arguments are absent", async () => {
    process.env.SCREENSCRAPER_SECRET_KEY = "cli-secret";

    const rotation = await gatherRotationInput({
      username: "captain",
      password: "wheel",
      "dev-id": "dev",
      "dev-password": "pw",
      "secret-key": "cli-secret",
    });

    expect(rotation).toEqual({
      username: "captain",
      password: "wheel",
      developerId: "dev",
      developerPassword: "pw",
      secretKey: "cli-secret",
    });
  });

  it("generates encrypted output for rotation workflows", async () => {
    process.env.SCREENSCRAPER_SECRET_KEY = "encryption-secret-value";
    const output = await runRotation([
      "--username=crew",
      "--password=treaz",
      "--dev-id=developer",
      "--dev-password=devpass",
      "--secret-key=encryption-secret-value",
    ]);

    expect(output).toContain("Rotation summary");
    expect(output).toContain("SCREENSCRAPER_USERNAME=crew");
    expect(output).toContain("Next steps");
  });
});
