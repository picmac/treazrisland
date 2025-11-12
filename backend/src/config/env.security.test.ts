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
    delete process.env.TREAZ_RUNTIME_ENV;
    delete process.env.GITHUB_ACTIONS;
  });

  afterEach(() => {
    vi.resetModules();
    restoreEnv(snapshot);
  });

  it("defaults to automatic mode when TREAZ_TLS_MODE is unset", async () => {
    const module = await import("./env.js");

    expect(module.env.TREAZ_TLS_MODE).toBe("http");
    expect(module.env.TLS_ENABLED).toBe(false);
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

  it("treats automatic mode as HTTP outside production", async () => {
    process.env.TREAZ_TLS_MODE = "auto";
    process.env.NODE_ENV = "development";

    const module = await import("./env.js");

    expect(module.env.TREAZ_TLS_MODE).toBe("http");
    expect(module.env.TLS_ENABLED).toBe(false);
  });

  it("treats automatic mode as HTTPS in production", async () => {
    process.env.TREAZ_TLS_MODE = "auto";
    process.env.NODE_ENV = "production";

    const module = await import("./env.js");

    expect(module.env.TREAZ_TLS_MODE).toBe("https");
    expect(module.env.TLS_ENABLED).toBe(true);
  });

  it("treats GitHub Actions as development for automatic TLS", async () => {
    process.env.TREAZ_TLS_MODE = "auto";
    process.env.NODE_ENV = "production";
    process.env.GITHUB_ACTIONS = "true";

    const module = await import("./env.js");

    expect(module.env.TREAZ_TLS_MODE).toBe("http");
    expect(module.env.TLS_ENABLED).toBe(false);
    expect(module.env.RUNTIME_STAGE).toBe("development");
  });

  it("falls back to LAN-friendly defaults when NODE_ENV is missing", async () => {
    process.env.TREAZ_TLS_MODE = "auto";
    delete process.env.NODE_ENV;
    delete process.env.TREAZ_RUNTIME_ENV;
    delete process.env.GITHUB_ACTIONS;

    const module = await import("./env.js");

    expect(module.env.TREAZ_TLS_MODE).toBe("http");
    expect(module.env.TLS_ENABLED).toBe(false);
    expect(module.env.RUNTIME_STAGE).toBe("development");
  });

  it("prefers TREAZ_RUNTIME_ENV when resolving automatic mode", async () => {
    process.env.TREAZ_TLS_MODE = "auto";
    process.env.NODE_ENV = "development";
    process.env.TREAZ_RUNTIME_ENV = "internet";

    const module = await import("./env.js");

    expect(module.env.TREAZ_TLS_MODE).toBe("https");
    expect(module.env.TLS_ENABLED).toBe(true);
    expect(module.env.TREAZ_RUNTIME_ENV).toBe("production");
    expect(module.env.RUNTIME_STAGE).toBe("production");
  });

  it("allows opting into LAN mode via TREAZ_RUNTIME_ENV", async () => {
    process.env.TREAZ_TLS_MODE = "auto";
    process.env.NODE_ENV = "production";
    process.env.TREAZ_RUNTIME_ENV = "lan";

    const module = await import("./env.js");

    expect(module.env.TREAZ_TLS_MODE).toBe("http");
    expect(module.env.TLS_ENABLED).toBe(false);
    expect(module.env.TREAZ_RUNTIME_ENV).toBe("development");
    expect(module.env.RUNTIME_STAGE).toBe("development");
  });

  it("rejects unsupported TLS modes", async () => {
    process.env.TREAZ_TLS_MODE = "maybe";

    await expect(import("./env.js")).rejects.toThrow(
      /TREAZ_TLS_MODE must be one of/,
    );
  });

  it("rejects unsupported runtime stages", async () => {
    process.env.TREAZ_RUNTIME_ENV = "space";

    await expect(import("./env.js")).rejects.toThrow(
      /TREAZ_RUNTIME_ENV must be one of/,
    );
  });
});

describe("netplay ice configuration", () => {
  let snapshot: EnvSnapshot;

  beforeEach(() => {
    vi.resetModules();
    snapshot = { ...process.env };

    seedRequiredEnv();
    delete process.env.NETPLAY_STUN_URIS;
    delete process.env.NETPLAY_TURN_URIS;
    delete process.env.NETPLAY_TURN_USERNAME;
    delete process.env.NETPLAY_TURN_PASSWORD;
  });

  afterEach(() => {
    vi.resetModules();
    restoreEnv(snapshot);
  });

  it("allows startup without ICE overrides", async () => {
    const module = await import("./env.js");

    expect(module.env.NETPLAY_STUN_URIS).toEqual([]);
    expect(module.env.NETPLAY_TURN_URIS).toEqual([]);
  });

  it("requires credentials when TURN URIs are provided", async () => {
    process.env.NETPLAY_TURN_URIS = "turn:turn.example:3478";

    await expect(import("./env.js")).rejects.toThrow(
      "NETPLAY_TURN_URIS requires NETPLAY_TURN_USERNAME and NETPLAY_TURN_PASSWORD",
    );
  });

  it("parses STUN and TURN configuration", async () => {
    process.env.NETPLAY_STUN_URIS = "stun:turn.example:3478";
    process.env.NETPLAY_TURN_URIS = "turn:turn.example:3478?transport=udp";
    process.env.NETPLAY_TURN_USERNAME = "turn-user";
    process.env.NETPLAY_TURN_PASSWORD = "turn-secret";

    const module = await import("./env.js");

    expect(module.env.NETPLAY_STUN_URIS).toEqual([
      "stun:turn.example:3478",
    ]);
    expect(module.env.NETPLAY_TURN_URIS).toEqual([
      "turn:turn.example:3478?transport=udp",
    ]);
    expect(module.env.NETPLAY_TURN_USERNAME).toBe("turn-user");
    expect(module.env.NETPLAY_TURN_PASSWORD).toBe("turn-secret");
  });
});
