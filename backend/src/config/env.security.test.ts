import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type EnvSnapshot = NodeJS.ProcessEnv;

const REQUIRED_ENV: Record<string, string> = {
  NODE_ENV: "test",
  PORT: "0",
  JWT_SECRET: "test-secret-32-characters-minimum-value",
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "30d",
  PASSWORD_RESET_TTL: "1h",
  USER_INVITE_EXPIRY_HOURS: "24",
  STORAGE_DRIVER: "filesystem",
  STORAGE_BUCKET_ASSETS: "assets",
  STORAGE_BUCKET_ROMS: "roms",
  STORAGE_BUCKET_BIOS: "bios",
  ROM_UPLOAD_MAX_BYTES: `${1024 * 1024}`,
  MFA_ISSUER: "TREAZRISLAND",
  MFA_RECOVERY_CODE_COUNT: "4",
  MFA_RECOVERY_CODE_LENGTH: "8",
  EMAIL_PROVIDER: "postmark",
  POSTMARK_SERVER_TOKEN: "postmark-token",
  POSTMARK_FROM_EMAIL: "observability@example.com",
  POSTMARK_MESSAGE_STREAM: "outbound",
};

function restoreEnv(snapshot: EnvSnapshot) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(snapshot)) {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
}

describe("env metrics safeguards", () => {
  let snapshot: EnvSnapshot;

  beforeEach(() => {
    vi.resetModules();
    snapshot = { ...process.env };

    for (const [key, value] of Object.entries(REQUIRED_ENV)) {
      process.env[key] = value;
    }

    delete process.env.METRICS_ENABLED;
    delete process.env.METRICS_TOKEN;
    delete process.env.METRICS_ALLOWED_CIDRS;
  });

  afterEach(() => {
    vi.resetModules();
    restoreEnv(snapshot);
  });

  it("throws when metrics are enabled without safeguards", async () => {
    process.env.METRICS_ENABLED = "true";

    await expect(import("./env.js")).rejects.toThrow(
      "METRICS_ENABLED requires METRICS_TOKEN or METRICS_ALLOWED_CIDRS",
    );
  });

  it("allows startup when a metrics token is configured", async () => {
    process.env.METRICS_ENABLED = "true";
    process.env.METRICS_TOKEN = "test-metrics-token";

    const module = await import("./env.js");

    expect(module.env.METRICS_ENABLED).toBe(true);
    expect(module.env.METRICS_TOKEN).toBe("test-metrics-token");
  });

  it("allows startup when CIDR restrictions are configured", async () => {
    process.env.METRICS_ENABLED = "true";
    process.env.METRICS_ALLOWED_CIDRS = "10.10.0.0/16";

    const module = await import("./env.js");

    expect(module.env.METRICS_ENABLED).toBe(true);
    expect(module.env.METRICS_ALLOWED_CIDRS).toEqual(["10.10.0.0/16"]);
    expect(module.env.METRICS_TOKEN).toBeUndefined();
  });
});
