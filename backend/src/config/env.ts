import { config as loadEnv } from "dotenv";
import { z } from "zod";
import ms, { StringValue } from "ms";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.string().regex(/^\d+$/).transform(Number).default("3001"),
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
  EMAIL_PROVIDER: z.enum(["postmark"]).default("postmark"),
  POSTMARK_SERVER_TOKEN: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  POSTMARK_FROM_EMAIL: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  POSTMARK_MESSAGE_STREAM: z
    .string()
    .optional()
    .transform((value) =>
      value && value.trim().length > 0 ? value.trim() : undefined,
    ),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  RATE_LIMIT_DEFAULT_POINTS: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default("60"),
  RATE_LIMIT_DEFAULT_DURATION: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default("60"),
  RATE_LIMIT_AUTH_POINTS: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default("5"),
  RATE_LIMIT_AUTH_DURATION: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default("60"),
  USER_INVITE_EXPIRY_HOURS: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default("168"),
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
  STORAGE_BUCKET_ASSETS: z.string().min(1),
  STORAGE_BUCKET_ROMS: z.string().min(1),
  STORAGE_BUCKET_BIOS: z
    .string()
    .optional()
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
    .transform(Number)
    .default(String(1024 * 1024 * 1024)),
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
    .transform(Number)
    .default("30"),
  SCREENSCRAPER_CONCURRENCY: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default("2"),
  SCREENSCRAPER_TIMEOUT_MS: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default("15000"),
  SCREENSCRAPER_DEFAULT_LANGUAGE_PRIORITY: z.string().default("en,fr"),
  SCREENSCRAPER_DEFAULT_REGION_PRIORITY: z.string().default("us,eu,wor,jp"),
  SCREENSCRAPER_DEFAULT_MEDIA_TYPES: z
    .string()
    .default("box-2D,box-3D,wheel,marquee,screenshot,titlescreen"),
  SCREENSCRAPER_ONLY_BETTER_MEDIA: z.string().default("true"),
  SCREENSCRAPER_MAX_ASSETS_PER_TYPE: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default("3"),
  PLAY_STATE_MAX_BYTES: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default(String(5 * 1024 * 1024)),
  PLAY_STATE_MAX_PER_ROM: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .default("5"),
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
if (typeof accessMs !== "number" || accessMs <= 0) {
  throw new Error("JWT_ACCESS_TTL must be a positive duration string");
}
if (typeof refreshMs !== "number" || refreshMs <= 0) {
  throw new Error("JWT_REFRESH_TTL must be a positive duration string");
}
if (typeof passwordResetMs !== "number" || passwordResetMs <= 0) {
  throw new Error("PASSWORD_RESET_TTL must be a positive duration string");
}

if (
  signedUrlTtlMs !== undefined &&
  (typeof signedUrlTtlMs !== "number" || signedUrlTtlMs <= 0)
) {
  throw new Error(
    "STORAGE_SIGNED_URL_TTL must be a positive duration string when set",
  );
}

if (parsed.data.EMAIL_PROVIDER === "postmark") {
  const missingPostmark = [
    ["POSTMARK_SERVER_TOKEN", parsed.data.POSTMARK_SERVER_TOKEN],
    ["POSTMARK_FROM_EMAIL", parsed.data.POSTMARK_FROM_EMAIL],
  ].filter(([, value]) => !value);

  if (missingPostmark.length > 0) {
    throw new Error(
      `Postmark provider requires configuration for: ${missingPostmark
        .map(([key]) => key)
        .join(", ")}`,
    );
  }

  if (!parsed.data.POSTMARK_FROM_EMAIL!.includes("@")) {
    throw new Error("POSTMARK_FROM_EMAIL must be a valid email address");
  }
}

if (
  parsed.data.USER_INVITE_EXPIRY_HOURS <= 0 ||
  parsed.data.USER_INVITE_EXPIRY_HOURS > 720
) {
  throw new Error("USER_INVITE_EXPIRY_HOURS must be between 1 and 720 hours");
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

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

export const env = {
  ...parsed.data,
  LOG_LEVEL:
    parsed.data.LOG_LEVEL ??
    (parsed.data.NODE_ENV === "production" ? "info" : "debug"),
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
  EMAIL_PROVIDER: parsed.data.EMAIL_PROVIDER,
  POSTMARK_SERVER_TOKEN: parsed.data.POSTMARK_SERVER_TOKEN!,
  POSTMARK_FROM_EMAIL: parsed.data.POSTMARK_FROM_EMAIL!,
  POSTMARK_MESSAGE_STREAM: parsed.data.POSTMARK_MESSAGE_STREAM,
  PLAY_STATE_MAX_BYTES: parsed.data.PLAY_STATE_MAX_BYTES,
  PLAY_STATE_MAX_PER_ROM: parsed.data.PLAY_STATE_MAX_PER_ROM,
  METRICS_ENABLED: parsed.data.METRICS_ENABLED ?? false,
  METRICS_TOKEN: parsed.data.METRICS_TOKEN,
};
