import { describe, expect, it } from "vitest";
import {
  type EmailSettings,
  type MetricsSettings,
  type PersonalizationSettings,
  type ScreenScraperSettings,
  type StorageSettings,
  type SystemProfileSettings,
} from "@/src/lib/api/admin/settings";
import {
  type EmailSettingsFormValues,
  type MetricsSettingsFormValues,
  type PersonalizationFormValues,
  type ScreenScraperFormValues,
  type StorageSettingsFormValues,
  type SystemProfileSettingsFormValues,
  validateEmailSection,
  validateMetricsSection,
  validatePersonalizationSection,
  validateScreenScraperSection,
  validateStorageSection,
  validateSystemProfileSection,
} from "../validation";

describe("validateSystemProfileSection", () => {
  const current: SystemProfileSettings = {
    instanceName: "TREAZRISLAND",
    timezone: "UTC",
  };

  it("rejects invalid URLs", () => {
    const values: SystemProfileSettingsFormValues = {
      instanceName: "TREAZRISLAND",
      timezone: "UTC",
      baseUrl: "not-a-url",
    };

    const result = validateSystemProfileSection(values, current);
    expect(result.errors.baseUrl).toBe("Enter a valid URL.");
    expect(result.data).toBeNull();
    expect(result.changed).toBe(false);
  });

  it("detects meaningful updates", () => {
    const values: SystemProfileSettingsFormValues = {
      instanceName: "Treaz",
      timezone: "UTC",
      baseUrl: "https://example.com",
    };

    const result = validateSystemProfileSection(values, current);
    expect(result.errors).toEqual({});
    expect(result.data).toEqual({
      instanceName: "Treaz",
      timezone: "UTC",
      baseUrl: "https://example.com",
    });
    expect(result.changed).toBe(true);
  });
});

describe("validateStorageSection", () => {
  const filesystemCurrent: StorageSettings = {
    driver: "filesystem",
    localRoot: "/var/lib/treaz",
    bucketAssets: "assets",
    bucketRoms: "roms",
  };

  it("requires S3 secrets when driver is s3", () => {
    const values: StorageSettingsFormValues = {
      driver: "s3",
      localRoot: "",
      bucketAssets: "assets",
      bucketRoms: "roms",
      bucketBios: "",
      signedUrlTTLSeconds: "",
      s3Endpoint: "https://minio.example",
      s3Region: "us-east-1",
      s3AccessKey: "access",
      s3SecretKey: "",
      s3ForcePathStyle: true,
    };

    const result = validateStorageSection(values, filesystemCurrent, undefined);
    expect(result.errors.s3SecretKey).toBe("Secret key is required.");
    expect(result.data).toBeNull();
  });

  it("keeps existing secret when not replaced", () => {
    const current: StorageSettings = {
      ...filesystemCurrent,
      driver: "s3",
      s3: {
        endpoint: "https://minio.example",
        region: "us-east-1",
        accessKey: "access",
        secretKey: "secret",
        forcePathStyle: true,
      },
    };
    const values: StorageSettingsFormValues = {
      driver: "s3",
      localRoot: current.localRoot,
      bucketAssets: "assets",
      bucketRoms: "roms",
      bucketBios: "",
      signedUrlTTLSeconds: "",
      s3Endpoint: current.s3!.endpoint,
      s3Region: current.s3!.region,
      s3AccessKey: current.s3!.accessKey,
      s3SecretKey: "",
      s3ForcePathStyle: true,
    };

    const result = validateStorageSection(values, current, current.s3?.secretKey);
    expect(result.errors).toEqual({});
    expect(result.data?.s3?.secretKey).toBe("secret");
    expect(result.changed).toBe(false);
  });
});

describe("validateEmailSection", () => {
  const current: EmailSettings = { provider: "none" };

  it("passes through when provider disabled", () => {
    const values: EmailSettingsFormValues = {
      provider: "none",
      host: "",
      port: "",
      secure: "starttls",
      fromEmail: "",
      fromName: "",
      allowInvalidCerts: false,
      enableAuth: false,
      authUsername: "",
      authPassword: "",
    };

    const result = validateEmailSection(values, current);
    expect(result.errors).toEqual({});
    expect(result.changed).toBe(false);
    expect(result.data).toEqual({ provider: "none" });
  });

  it("validates SMTP configuration", () => {
    const values: EmailSettingsFormValues = {
      provider: "smtp",
      host: "smtp.example",
      port: "abc",
      secure: "starttls",
      fromEmail: "invalid",
      fromName: "Crew",
      allowInvalidCerts: false,
      enableAuth: true,
      authUsername: "",
      authPassword: "",
    };

    const result = validateEmailSection(values, current);
    expect(result.errors.port).toBe("Enter a valid port.");
    expect(result.errors.fromEmail).toBe("Enter a valid email.");
    expect(result.errors.authUsername).toBe("Username is required.");
    expect(result.errors.authPassword).toBe("Password is required.");
    expect(result.data).toBeNull();
  });
});

describe("validateMetricsSection", () => {
  const current: MetricsSettings = { enabled: false, allowedCidrs: [] };

  it("requires token when enabling metrics", () => {
    const values: MetricsSettingsFormValues = {
      enabled: true,
      token: "",
      allowedCidrs: "10.0.0.0/24",
    };

    const result = validateMetricsSection(values, current);
    expect(result.errors.token).toBe("Token is required when metrics are enabled.");
    expect(result.data).toBeNull();
  });

  it("parses allowed CIDRs", () => {
    const values: MetricsSettingsFormValues = {
      enabled: true,
      token: "secret",
      allowedCidrs: "10.0.0.0/24\n192.168.0.0/16",
    };

    const result = validateMetricsSection(values, current);
    expect(result.errors).toEqual({});
    expect(result.data?.allowedCidrs).toEqual(["10.0.0.0/24", "192.168.0.0/16"]);
    expect(result.changed).toBe(true);
  });
});

describe("validateScreenScraperSection", () => {
  const current: ScreenScraperSettings = {
    username: "pirate",
    password: "stored",
    secretKey: "stored-secret",
    onlyBetterMedia: true,
  };

  it("preserves stored secrets when fields left blank", () => {
    const values: ScreenScraperFormValues = {
      username: "pirate",
      password: "",
      secretKey: "",
      devId: "",
      devPassword: "",
      baseUrl: "",
      requestsPerMinute: "",
      concurrency: "",
      timeoutMs: "",
      languagePriority: "",
      regionPriority: "",
      mediaTypes: "",
      onlyBetterMedia: true,
      maxAssetsPerType: "",
    };

    const result = validateScreenScraperSection(values, current, {
      existingPassword: "stored",
      existingSecret: "stored-secret",
      existingDevPassword: undefined,
    });

    expect(result.errors).toEqual({});
    expect(result.data?.password).toBe("stored");
    expect(result.data?.secretKey).toBe("stored-secret");
    expect(result.changed).toBe(false);
  });

  it("validates numeric fields", () => {
    const values: ScreenScraperFormValues = {
      username: "",
      password: "",
      secretKey: "",
      devId: "",
      devPassword: "",
      baseUrl: "https://screenscraper.example",
      requestsPerMinute: "-1",
      concurrency: "abc",
      timeoutMs: "0",
      languagePriority: "en\nfr",
      regionPriority: "",
      mediaTypes: "",
      onlyBetterMedia: false,
      maxAssetsPerType: "",
    };

    const result = validateScreenScraperSection(values, current, {});
    expect(result.errors.requestsPerMinute).toBe("Enter a positive integer.");
    expect(result.errors.concurrency).toBe("Enter a positive integer.");
    expect(result.errors.timeoutMs).toBe("Enter a positive integer.");
    expect(result.data).toBeNull();
  });
});

describe("validatePersonalizationSection", () => {
  const current: PersonalizationSettings = {};

  it("marks theme changes", () => {
    const values: PersonalizationFormValues = { theme: "midnight-harbor" };
    const result = validatePersonalizationSection(values, current);
    expect(result.errors).toEqual({});
    expect(result.data).toEqual({ theme: "midnight-harbor" });
    expect(result.changed).toBe(true);
  });
});
