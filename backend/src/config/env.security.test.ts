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
  EMAIL_PROVIDER: "smtp",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_SECURE: "starttls",
  SMTP_USERNAME: "mailer",
  SMTP_PASSWORD: "secret",
  SMTP_FROM_EMAIL: "observability@example.com",
  SMTP_FROM_NAME: "Observability Bot",
  SMTP_ALLOW_INVALID_CERTS: "false",
};

function seedRequiredEnv(overrides: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    process.env[key] = value;
  }

  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

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

    seedRequiredEnv();

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

describe("env TLS mode validation", () => {
  let snapshot: EnvSnapshot;

  beforeEach(() => {
    vi.resetModules();
    snapshot = { ...process.env };

    seedRequiredEnv();
    delete process.env.TREAZ_TLS_MODE;
  });

  afterEach(() => {
    vi.resetModules();
    restoreEnv(snapshot);
  });

  it("defaults to https when TREAZ_TLS_MODE is unset", async () => {
    const module = await import("./env.js");

    expect(module.env.TREAZ_TLS_MODE).toBe("https");
    expect(module.env.TLS_ENABLED).toBe(true);
  });

  it.each([
    ["https", "https", true],
    ["HTTPS", "https", true],
    [" true ", "https", true],
    ["1", "https", true],
    ["on", "https", true]
  ])(
    "normalises TLS-enabled alias %s",
    async (alias, expectedMode, expectedTlsEnabled) => {
      process.env.TREAZ_TLS_MODE = alias;

      const module = await import("./env.js");

      expect(module.env.TREAZ_TLS_MODE).toBe(expectedMode);
      expect(module.env.TLS_ENABLED).toBe(expectedTlsEnabled);
    }
  );

  it.each([
    ["http", "http", false],
    ["HTTP", "http", false],
    [" 0 ", "http", false],
    ["false", "http", false],
    ["off", "http", false]
  ])(
    "normalises TLS-disabled alias %s",
    async (alias, expectedMode, expectedTlsEnabled) => {
      process.env.TREAZ_TLS_MODE = alias;

      const module = await import("./env.js");

      expect(module.env.TREAZ_TLS_MODE).toBe(expectedMode);
      expect(module.env.TLS_ENABLED).toBe(expectedTlsEnabled);
    }
  );

  it("rejects unsupported TLS modes", async () => {
    process.env.TREAZ_TLS_MODE = "maybe";

    await expect(import("./env.js")).rejects.toThrow(
      /TREAZ_TLS_MODE must be one of/,
    );
  });
});
