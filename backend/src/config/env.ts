import { config as loadEnv } from "dotenv";
import { z } from "zod";
import ms, { StringValue } from "ms";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().regex(/^\d+$/).transform(Number).default("3001"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  RATE_LIMIT_DEFAULT_POINTS: z.string().regex(/^\d+$/).transform(Number).default("60"),
  RATE_LIMIT_DEFAULT_DURATION: z.string().regex(/^\d+$/).transform(Number).default("60"),
  RATE_LIMIT_AUTH_POINTS: z.string().regex(/^\d+$/).transform(Number).default("5"),
  RATE_LIMIT_AUTH_DURATION: z.string().regex(/^\d+$/).transform(Number).default("60")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const messages = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${messages}`);
}

const accessMs = ms(parsed.data.JWT_ACCESS_TTL as StringValue);
const refreshMs = ms(parsed.data.JWT_REFRESH_TTL as StringValue);

if (typeof accessMs !== "number" || accessMs <= 0) {
  throw new Error("JWT_ACCESS_TTL must be a positive duration string");
}
if (typeof refreshMs !== "number" || refreshMs <= 0) {
  throw new Error("JWT_REFRESH_TTL must be a positive duration string");
}

export const env = {
  ...parsed.data,
  JWT_ACCESS_TTL_MS: accessMs,
  JWT_REFRESH_TTL_MS: refreshMs
};
