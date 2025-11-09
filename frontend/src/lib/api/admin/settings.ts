import { apiFetch } from "@lib/api/client";

export type StorageDriver = "filesystem" | "s3";

export interface SystemProfileSettings {
  instanceName: string;
  timezone: string;
  baseUrl?: string;
}

export interface StorageSettings {
  driver: StorageDriver;
  localRoot: string;
  bucketAssets: string;
  bucketRoms: string;
  bucketBios?: string;
  signedUrlTTLSeconds?: number;
  s3?: {
    endpoint?: string;
    region?: string;
    accessKey?: string;
    secretKey?: string;
    forcePathStyle?: boolean;
  };
}

export interface EmailSettings {
  provider: "none" | "smtp";
  smtp?: {
    host?: string;
    port?: number;
    secure?: "none" | "starttls" | "implicit";
    fromEmail?: string;
    fromName?: string;
    allowInvalidCerts?: boolean;
    auth?: {
      username?: string;
      password?: string;
    };
  };
}

export interface MetricsSettings {
  enabled: boolean;
  token?: string;
  allowedCidrs: string[];
}

export interface ScreenScraperSettings {
  username?: string;
  password?: string;
  secretKey?: string;
  devId?: string;
  devPassword?: string;
  baseUrl?: string;
  requestsPerMinute?: number;
  concurrency?: number;
  timeoutMs?: number;
  languagePriority?: string[];
  regionPriority?: string[];
  mediaTypes?: string[];
  onlyBetterMedia?: boolean;
  maxAssetsPerType?: number;
}

export interface PersonalizationSettings {
  theme?: string;
}

export interface ResolvedSystemSettings {
  systemProfile: SystemProfileSettings;
  storage: StorageSettings;
  email: EmailSettings;
  metrics: MetricsSettings;
  screenscraper: ScreenScraperSettings;
  personalization: PersonalizationSettings;
}

export type SettingsUpdatePayload = Partial<{
  systemProfile: Partial<SystemProfileSettings>;
  storage: Partial<StorageSettings>;
  email: Partial<EmailSettings>;
  metrics: Partial<MetricsSettings>;
  screenscraper: Partial<ScreenScraperSettings>;
  personalization: Partial<PersonalizationSettings>;
}>;

export async function fetchAdminSettings(): Promise<ResolvedSystemSettings> {
  return apiFetch<ResolvedSystemSettings>("/admin/settings", { method: "GET" });
}

export async function updateAdminSettings(
  payload: SettingsUpdatePayload,
): Promise<ResolvedSystemSettings> {
  return apiFetch<ResolvedSystemSettings>("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}
