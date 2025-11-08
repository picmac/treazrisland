import { config as loadEnv } from "dotenv";
import { z } from "zod";
import ms, { StringValue } from "ms";
import ipaddr from "ipaddr.js";
import { ensureBootstrapSecrets } from "./bootstrapSecrets.js";

loadEnv();

export const bootstrapSecrets = ensureBootstrapSecrets();

const TLS_ENABLED_VALUES = new Set(["https", "true", "1", "on"]);
const TLS_DISABLED_VALUES = new Set(["http", "false", "0", "off"]);

function isValidIp(value: string): boolean {
  try {
    ipaddr.parse(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeTlsMode(value?: string | null): "https" | "http" {
  if (!value || value.trim().length === 0) {
    return "https";
  }

  const normalized = value.trim().toLowerCase();
  if (TLS_ENABLED_VALUES.has(normalized)) {
    return "https";
  }

  if (TLS_DISABLED_VALUES.has(normalized)) {
    return "http";
  }

  throw new Error(
    "TREAZ_TLS_MODE must be one of https, http, true, false, 1, 0, on, off",
  );
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.string().regex(/^\d+$/).default("3001").transform(Number),
  TREAZ_TLS_MODE: z
    .string()
    .optional()
    .transform((value) => normalizeTlsMode(value)),
  LISTEN_HOST: z
    .string()
    .default("0.0.0.0")
    .transform((value) => value.trim())
    .refine(
      (value) =>
        value === "0.0.0.0" ||
        value === "::" ||
        value === "localhost" ||
        isValidIp(value),
      {
        message: "LISTEN_HOST must be 0.0.0.0, ::, localhost, or a valid IP",
      },
    ),
  LOG_LEVEL: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  PASSWORD_RESET_TTL: z.string().default("1h"),
  MFA_ISSUER: z
    .string()
    .default("TREAZRISLAND")
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "MFA_ISSUER cannot be empty",
    }),
  MFA_ENCRYPTION_KEY: z
    .string()
    .min(32, "MFA_ENCRYPTION_KEY must be at least 32 characters"),
  MFA_RECOVERY_CODE_COUNT: z
    .string()
    .regex(/^\d+$/)
    .default("10")
    .transform(Number),
  MFA_RECOVERY_CODE_LENGTH: z
    .string()
    .regex(/^\d+$/)
    .default("10")
    .transform(Number),
  EMAIL_PROVIDER: z.enum(["none", "smtp"]).default("none"),
  SMTP_HOST: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  SMTP_PORT: z
    .string()
    .regex(/^\d+$/)
    .default("587")
    .transform(Number),
  SMTP_SECURE: z
    .enum(["none", "starttls", "implicit"])
    .default("starttls"),
  SMTP_USERNAME: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  SMTP_PASSWORD: z
    .string()
    .optional()
    .transform((value) =>
      value && value.length > 0 ? value : undefined,
    ),
  SMTP_FROM_EMAIL: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  SMTP_FROM_NAME: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  SMTP_ALLOW_INVALID_CERTS: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return false;
      }

      const normalized = value.trim().toLowerCase();
      return normalized === "true" || normalized === "1";
    }),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  RATE_LIMIT_DEFAULT_POINTS: z
    .string()
    .regex(/^\d+$/)
    .default("60")
    .transform(Number),
  RATE_LIMIT_DEFAULT_DURATION: z
    .string()
    .regex(/^\d+$/)
    .default("60")
    .transform(Number),
  RATE_LIMIT_AUTH_POINTS: z
    .string()
    .regex(/^\d+$/)
    .default("5")
    .transform(Number),
  RATE_LIMIT_AUTH_DURATION: z
    .string()
    .regex(/^\d+$/)
    .default("60")
    .transform(Number),
  USER_INVITE_EXPIRY_HOURS: z
    .string()
    .regex(/^\d+$/)
    .default("168")
    .transform(Number),
  STORAGE_DRIVER: z.enum(["filesystem", "s3"]).default("filesystem"),
  STORAGE_LOCAL_ROOT: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  STORAGE_ENDPOINT: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  STORAGE_REGION: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  STORAGE_ACCESS_KEY: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  STORAGE_SECRET_KEY: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value : undefined,
    ),
  STORAGE_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined
        ? true
        : value.toLowerCase() === "true" || value === "1",
    ),
  STORAGE_BUCKET_ASSETS: z.string().default("assets"),
  STORAGE_BUCKET_ROMS: z.string().default("roms"),
  STORAGE_BUCKET_BIOS: z
    .string()
    .default("bios")
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  STORAGE_SIGNED_URL_TTL: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  ROM_UPLOAD_MAX_BYTES: z
    .string()
    .regex(/^\d+$/)
    .default(String(1024 * 1024 * 1024))
    .transform(Number),
  SCREENSCRAPER_USERNAME: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  SCREENSCRAPER_PASSWORD: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value : undefined,
    ),
  SCREENSCRAPER_SECRET_KEY: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value : undefined,
    ),
  SCREENSCRAPER_DEV_ID_ENC: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value : undefined,
    ),
  SCREENSCRAPER_DEV_PASSWORD_ENC: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value : undefined,
    ),
  SCREENSCRAPER_BASE_URL: z
    .string()
    .url()
    .default("https://www.screenscraper.fr/api2"),
  SCREENSCRAPER_REQUESTS_PER_MINUTE: z
    .string()
    .regex(/^\d+$/)
    .default("30")
    .transform(Number),
  SCREENSCRAPER_CONCURRENCY: z
    .string()
    .regex(/^\d+$/)
    .default("2")
    .transform(Number),
  SCREENSCRAPER_TIMEOUT_MS: z
    .string()
    .regex(/^\d+$/)
    .default("15000")
    .transform(Number),
  SCREENSCRAPER_DEFAULT_LANGUAGE_PRIORITY: z.string().default("en,fr"),
  SCREENSCRAPER_DEFAULT_REGION_PRIORITY: z.string().default("us,eu,wor,jp"),
  SCREENSCRAPER_DEFAULT_MEDIA_TYPES: z
    .string()
    .default("box-2D,box-3D,wheel,marquee,screenshot,titlescreen"),
  SCREENSCRAPER_ONLY_BETTER_MEDIA: z.string().default("true"),
  SCREENSCRAPER_MAX_ASSETS_PER_TYPE: z
    .string()
    .regex(/^\d+$/)
    .default("3")
    .transform(Number),
  PLAY_STATE_MAX_BYTES: z
    .string()
    .regex(/^\d+$/)
    .default(String(5 * 1024 * 1024))
    .transform(Number),
  PLAY_STATE_MAX_PER_ROM: z
    .string()
    .regex(/^\d+$/)
    .default("5")
    .transform(Number),
  USER_AVATAR_MAX_BYTES: z
    .string()
    .regex(/^\d+$/)
    .default(String(5 * 1024 * 1024))
    .transform(Number),
  METRICS_ENABLED: z
    .string()
    .optional()
    .transform((value) =>
      value === undefined
        ? false
        : value.toLowerCase() === "true" || value === "1",
    ),
  METRICS_TOKEN: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value : undefined,
    ),
  METRICS_ALLOWED_CIDRS: z
    .string()
    .optional()
    .transform((value) => {
      const entries = value && value.trim().length > 0 ? splitCsv(value) : [];

      for (const entry of entries) {
        try {
          if (entry.includes("/")) {
            ipaddr.parseCIDR(entry);
          } else {
            ipaddr.parse(entry);
          }
        } catch (error) {
          throw new Error(
            `METRICS_ALLOWED_CIDRS contains an invalid CIDR or address: ${entry}`,
          );
        }
      }

      return entries;
    }),
  NETPLAY_IDLE_TIMEOUT: z.string().default("10m"),
  NETPLAY_MAX_HOSTED_SESSIONS: z
    .string()
    .regex(/^\d+$/)
    .default("2")
    .transform(Number),
  NETPLAY_MAX_CONCURRENT_SESSIONS: z
    .string()
    .regex(/^\d+$/)
    .default("10")
    .transform(Number),
  NETPLAY_SIGNAL_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${messages}`);
}

const accessMs = ms(parsed.data.JWT_ACCESS_TTL as StringValue);
const refreshMs = ms(parsed.data.JWT_REFRESH_TTL as StringValue);
const passwordResetMs = ms(parsed.data.PASSWORD_RESET_TTL as StringValue);
const signedUrlTtlMs = parsed.data.STORAGE_SIGNED_URL_TTL
  ? ms(parsed.data.STORAGE_SIGNED_URL_TTL as StringValue)
  : undefined;
const tlsEnabled = parsed.data.TREAZ_TLS_MODE === "https";
const netplayIdleMs = ms(parsed.data.NETPLAY_IDLE_TIMEOUT as StringValue);
if (typeof accessMs !== "number" || accessMs <= 0) {
  throw new Error("JWT_ACCESS_TTL must be a positive duration string");
}
if (typeof refreshMs !== "number" || refreshMs <= 0) {
  throw new Error("JWT_REFRESH_TTL must be a positive duration string");
}
if (typeof passwordResetMs !== "number" || passwordResetMs <= 0) {
  throw new Error("PASSWORD_RESET_TTL must be a positive duration string");
}
if (typeof netplayIdleMs !== "number" || netplayIdleMs <= 0) {
  throw new Error("NETPLAY_IDLE_TIMEOUT must be a positive duration string");
}

if (
  signedUrlTtlMs !== undefined &&
  (typeof signedUrlTtlMs !== "number" || signedUrlTtlMs <= 0)
) {
  throw new Error(
    "STORAGE_SIGNED_URL_TTL must be a positive duration string when set",
  );
}

if (parsed.data.EMAIL_PROVIDER === "smtp") {
  const missingSmtp = [
    ["SMTP_HOST", parsed.data.SMTP_HOST],
    ["SMTP_FROM_EMAIL", parsed.data.SMTP_FROM_EMAIL],
  ].filter(([, value]) => !value);

  if (missingSmtp.length > 0) {
    throw new Error(
      `SMTP provider requires configuration for: ${missingSmtp
        .map(([key]) => key)
        .join(", ")}`,
    );
  }

  if (!parsed.data.SMTP_FROM_EMAIL!.includes("@")) {
    throw new Error("SMTP_FROM_EMAIL must be a valid email address");
  }

  if (parsed.data.SMTP_PORT <= 0 || parsed.data.SMTP_PORT > 65535) {
    throw new Error("SMTP_PORT must be between 1 and 65535");
  }

  const hasUsername = Boolean(parsed.data.SMTP_USERNAME);
  const hasPassword = Boolean(parsed.data.SMTP_PASSWORD);

  if (hasUsername !== hasPassword) {
    throw new Error(
      "SMTP authentication requires both SMTP_USERNAME and SMTP_PASSWORD",
    );
  }
}

if (
  parsed.data.USER_INVITE_EXPIRY_HOURS <= 0 ||
  parsed.data.USER_INVITE_EXPIRY_HOURS > 720
) {
  throw new Error("USER_INVITE_EXPIRY_HOURS must be between 1 and 720 hours");
}

if (
  parsed.data.MFA_RECOVERY_CODE_COUNT < 4 ||
  parsed.data.MFA_RECOVERY_CODE_COUNT > 24
) {
  throw new Error("MFA_RECOVERY_CODE_COUNT must be between 4 and 24");
}

if (
  parsed.data.MFA_RECOVERY_CODE_LENGTH < 6 ||
  parsed.data.MFA_RECOVERY_CODE_LENGTH > 32
) {
  throw new Error(
    "MFA_RECOVERY_CODE_LENGTH must be between 6 and 32 characters",
  );
}

if (parsed.data.METRICS_ENABLED) {
  const hasToken = Boolean(parsed.data.METRICS_TOKEN);
  const hasAllowedCidrs =
    Array.isArray(parsed.data.METRICS_ALLOWED_CIDRS) &&
    parsed.data.METRICS_ALLOWED_CIDRS.length > 0;

  if (!hasToken && !hasAllowedCidrs) {
    throw new Error(
      "METRICS_ENABLED requires METRICS_TOKEN or METRICS_ALLOWED_CIDRS",
    );
  }
}

if (parsed.data.STORAGE_DRIVER === "s3") {
  const missing = [
    ["STORAGE_ENDPOINT", parsed.data.STORAGE_ENDPOINT],
    ["STORAGE_REGION", parsed.data.STORAGE_REGION],
    ["STORAGE_ACCESS_KEY", parsed.data.STORAGE_ACCESS_KEY],
    ["STORAGE_SECRET_KEY", parsed.data.STORAGE_SECRET_KEY],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(
      `S3 storage driver requires configuration for: ${missing
        .map(([key]) => key)
        .join(", ")}`,
    );
  }
}

if (parsed.data.NETPLAY_MAX_HOSTED_SESSIONS <= 0) {
  throw new Error("NETPLAY_MAX_HOSTED_SESSIONS must be greater than zero");
}

if (parsed.data.NETPLAY_MAX_CONCURRENT_SESSIONS <= 0) {
  throw new Error("NETPLAY_MAX_CONCURRENT_SESSIONS must be greater than zero");
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export const env = {
  ...parsed.data,
  LOG_LEVEL:
    parsed.data.LOG_LEVEL ??
    (parsed.data.NODE_ENV === "production" ? "info" : "debug"),
  TREAZ_TLS_MODE: parsed.data.TREAZ_TLS_MODE,
  TLS_ENABLED: tlsEnabled,
  JWT_ACCESS_TTL_MS: accessMs,
  JWT_REFRESH_TTL_MS: refreshMs,
  PASSWORD_RESET_TTL_MS: passwordResetMs,
  USER_INVITE_EXPIRY_HOURS: parsed.data.USER_INVITE_EXPIRY_HOURS,
  USER_INVITE_EXPIRY_MS: parsed.data.USER_INVITE_EXPIRY_HOURS * 60 * 60 * 1000,
  STORAGE_FORCE_PATH_STYLE: parsed.data.STORAGE_FORCE_PATH_STYLE ?? true,
  STORAGE_SIGNED_URL_TTL_SECONDS:
    signedUrlTtlMs !== undefined
      ? Math.floor(signedUrlTtlMs / 1000)
      : undefined,
  USER_AVATAR_MAX_BYTES: parsed.data.USER_AVATAR_MAX_BYTES,
  SCREENSCRAPER_DEFAULT_LANGUAGE_PRIORITY: splitCsv(
    parsed.data.SCREENSCRAPER_DEFAULT_LANGUAGE_PRIORITY,
  ),
  SCREENSCRAPER_DEFAULT_REGION_PRIORITY: splitCsv(
    parsed.data.SCREENSCRAPER_DEFAULT_REGION_PRIORITY,
  ),
  SCREENSCRAPER_DEFAULT_MEDIA_TYPES: splitCsv(
    parsed.data.SCREENSCRAPER_DEFAULT_MEDIA_TYPES,
  ),
  SCREENSCRAPER_ONLY_BETTER_MEDIA:
    parsed.data.SCREENSCRAPER_ONLY_BETTER_MEDIA.toLowerCase() === "true" ||
    parsed.data.SCREENSCRAPER_ONLY_BETTER_MEDIA === "1",
  MFA_ISSUER: parsed.data.MFA_ISSUER,
  MFA_ENCRYPTION_KEY: parsed.data.MFA_ENCRYPTION_KEY,
  MFA_RECOVERY_CODE_COUNT: parsed.data.MFA_RECOVERY_CODE_COUNT,
  MFA_RECOVERY_CODE_LENGTH: parsed.data.MFA_RECOVERY_CODE_LENGTH,
  EMAIL_PROVIDER: parsed.data.EMAIL_PROVIDER,
  SMTP_HOST: parsed.data.SMTP_HOST,
  SMTP_PORT: parsed.data.SMTP_PORT,
  SMTP_SECURE: parsed.data.SMTP_SECURE,
  SMTP_USERNAME: parsed.data.SMTP_USERNAME,
  SMTP_PASSWORD: parsed.data.SMTP_PASSWORD,
  SMTP_FROM_EMAIL: parsed.data.SMTP_FROM_EMAIL,
  SMTP_FROM_NAME: parsed.data.SMTP_FROM_NAME,
  SMTP_ALLOW_INVALID_CERTS: parsed.data.SMTP_ALLOW_INVALID_CERTS ?? false,
  PLAY_STATE_MAX_BYTES: parsed.data.PLAY_STATE_MAX_BYTES,
  PLAY_STATE_MAX_PER_ROM: parsed.data.PLAY_STATE_MAX_PER_ROM,
  METRICS_ENABLED: parsed.data.METRICS_ENABLED ?? false,
  METRICS_TOKEN: parsed.data.METRICS_TOKEN,
  METRICS_ALLOWED_CIDRS: parsed.data.METRICS_ALLOWED_CIDRS ?? [],
  NETPLAY_IDLE_TIMEOUT: parsed.data.NETPLAY_IDLE_TIMEOUT,
  NETPLAY_IDLE_TIMEOUT_MS: netplayIdleMs,
  NETPLAY_MAX_HOSTED_SESSIONS: parsed.data.NETPLAY_MAX_HOSTED_SESSIONS,
  NETPLAY_MAX_CONCURRENT_SESSIONS: parsed.data.NETPLAY_MAX_CONCURRENT_SESSIONS,
  NETPLAY_SIGNAL_ALLOWED_ORIGINS: parsed.data.NETPLAY_SIGNAL_ALLOWED_ORIGINS
    ? splitCsv(parsed.data.NETPLAY_SIGNAL_ALLOWED_ORIGINS)
    : [],
};
