import path from "node:path";
import fp from "fastify-plugin";
import { z } from "zod";
import { env } from "../config/env.js";
import type { FastifyInstance } from "fastify";
import type { ExtendedPrismaClient } from "../types/prisma-extensions.js";

export const systemProfileSchema = z.object({
  instanceName: z.string().min(1),
  timezone: z.string().min(1),
  baseUrl: z.string().url().optional(),
});

export const storageSchema = z
  .object({
    driver: z.enum(["filesystem", "s3"]),
    localRoot: z.string().min(1),
    bucketAssets: z.string().min(1),
    bucketRoms: z.string().min(1),
    bucketBios: z.string().min(1).optional(),
    signedUrlTTLSeconds: z.number().int().positive().optional(),
    s3: z
      .object({
        endpoint: z.string().url(),
        region: z.string().min(1),
        accessKey: z.string().min(1),
        secretKey: z.string().min(1),
        forcePathStyle: z.boolean().default(true),
      })
      .partial()
      .optional(),
  })
  .refine(
    (value) =>
      value.driver === "filesystem" ||
      (value.s3 &&
        value.s3.endpoint &&
        value.s3.region &&
        value.s3.accessKey &&
        value.s3.secretKey),
    {
      message: "S3 configuration must include endpoint, region, accessKey, and secretKey.",
      path: ["s3"],
    },
  );

export const emailSchema = z.object({
  provider: z.enum(["none", "postmark"]),
  postmark: z
    .object({
      serverToken: z.string().min(1),
      fromEmail: z.string().email(),
      messageStream: z.string().min(1).optional(),
    })
    .optional(),
});

export const metricsSchema = z.object({
  enabled: z.boolean(),
  token: z.string().min(1).optional(),
  allowedCidrs: z.array(z.string()).default([]),
});

export const screenscraperSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  secretKey: z.string().optional(),
  devId: z.string().optional(),
  devPassword: z.string().optional(),
  baseUrl: z.string().url().optional(),
  requestsPerMinute: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  languagePriority: z.array(z.string()).optional(),
  regionPriority: z.array(z.string()).optional(),
  mediaTypes: z.array(z.string()).optional(),
  onlyBetterMedia: z.boolean().optional(),
  maxAssetsPerType: z.number().int().positive().optional(),
});

export const personalizationSchema = z.object({
  theme: z.string().optional(),
});

export type SystemProfileSettings = z.infer<typeof systemProfileSchema>;
export type StorageSettings = z.infer<typeof storageSchema>;
export type EmailSettings = z.infer<typeof emailSchema>;
export type MetricsSettings = z.infer<typeof metricsSchema>;
export type ScreenScraperSettings = z.infer<typeof screenscraperSchema>;
export type PersonalizationSettings = z.infer<typeof personalizationSchema>;

export interface ResolvedSystemSettings {
  systemProfile: SystemProfileSettings;
  storage: StorageSettings;
  email: EmailSettings;
  metrics: MetricsSettings;
  screenscraper: ScreenScraperSettings;
  personalization: PersonalizationSettings;
}

const defaultStorageLocalRoot = path.join(process.cwd(), "var", "storage");

const defaultSettings = (): ResolvedSystemSettings => ({
  systemProfile: {
    instanceName: "TREAZRISLAND",
    timezone: "UTC",
  },
  storage: {
    driver: env.STORAGE_DRIVER,
    localRoot: env.STORAGE_LOCAL_ROOT ?? defaultStorageLocalRoot,
    bucketAssets: env.STORAGE_BUCKET_ASSETS,
    bucketRoms: env.STORAGE_BUCKET_ROMS,
    bucketBios: env.STORAGE_BUCKET_BIOS,
    signedUrlTTLSeconds: env.STORAGE_SIGNED_URL_TTL_SECONDS,
    s3:
      env.STORAGE_DRIVER === "s3"
        ? {
            endpoint: env.STORAGE_ENDPOINT!,
            region: env.STORAGE_REGION!,
            accessKey: env.STORAGE_ACCESS_KEY!,
            secretKey: env.STORAGE_SECRET_KEY!,
            forcePathStyle: env.STORAGE_FORCE_PATH_STYLE ?? true,
          }
        : undefined,
  },
  email:
    env.EMAIL_PROVIDER === "postmark"
      ? {
          provider: "postmark",
          postmark: {
            serverToken: env.POSTMARK_SERVER_TOKEN!,
            fromEmail: env.POSTMARK_FROM_EMAIL!,
            messageStream: env.POSTMARK_MESSAGE_STREAM ?? undefined,
          },
        }
      : { provider: "none" },
  metrics: {
    enabled: env.METRICS_ENABLED ?? false,
    token: env.METRICS_TOKEN,
    allowedCidrs: env.METRICS_ALLOWED_CIDRS ?? [],
  },
  screenscraper: {
    username: env.SCREENSCRAPER_USERNAME,
    password: env.SCREENSCRAPER_PASSWORD,
    secretKey: env.SCREENSCRAPER_SECRET_KEY,
    devId: env.SCREENSCRAPER_DEV_ID_ENC,
    devPassword: env.SCREENSCRAPER_DEV_PASSWORD_ENC,
    baseUrl: env.SCREENSCRAPER_BASE_URL,
    requestsPerMinute: env.SCREENSCRAPER_REQUESTS_PER_MINUTE,
    concurrency: env.SCREENSCRAPER_CONCURRENCY,
    timeoutMs: env.SCREENSCRAPER_TIMEOUT_MS,
    languagePriority: env.SCREENSCRAPER_DEFAULT_LANGUAGE_PRIORITY,
    regionPriority: env.SCREENSCRAPER_DEFAULT_REGION_PRIORITY,
    mediaTypes: env.SCREENSCRAPER_DEFAULT_MEDIA_TYPES,
    onlyBetterMedia: env.SCREENSCRAPER_ONLY_BETTER_MEDIA,
    maxAssetsPerType: env.SCREENSCRAPER_MAX_ASSETS_PER_TYPE,
  },
  personalization: {},
});

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

type SettingsUpdatePayload = DeepPartial<ResolvedSystemSettings>;

type SettingKey =
  | "system.profile"
  | "storage"
  | "email"
  | "metrics"
  | "screenscraper"
  | "personalization";

const schemaByKey: Record<SettingKey, z.ZodTypeAny> = {
  "system.profile": systemProfileSchema.partial(),
  storage: storageSchema.partial(),
  email: emailSchema.partial(),
  metrics: metricsSchema.partial(),
  screenscraper: screenscraperSchema.partial(),
  personalization: personalizationSchema.partial(),
};

const keyToProperty: Record<SettingKey, keyof ResolvedSystemSettings> = {
  "system.profile": "systemProfile",
  storage: "storage",
  email: "email",
  metrics: "metrics",
  screenscraper: "screenscraper",
  personalization: "personalization",
};

const clone = <T>(value: T): T => structuredClone(value);

const deepMerge = <T extends Record<string, unknown>>(base: T, patch: T): T => {
  const result = clone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    const current = (result as Record<string, unknown>)[key];
    if (
      current &&
      typeof current === "object" &&
      !Array.isArray(current) &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        current as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
};

export interface SettingsManager {
  get(): ResolvedSystemSettings;
  reload(): Promise<ResolvedSystemSettings>;
  update(
    payload: SettingsUpdatePayload,
    options?: { actorId?: string },
  ): Promise<ResolvedSystemSettings>;
}

declare module "fastify" {
  interface FastifyInstance {
    settings: SettingsManager;
  }
}

const applyOverrides = (
  overrides: Record<keyof ResolvedSystemSettings, Record<string, unknown>>, 
): ResolvedSystemSettings => {
  let resolved = defaultSettings();
  for (const [property, patch] of Object.entries(overrides) as [
    keyof ResolvedSystemSettings,
    Record<string, unknown>,
  ][]) {
    if (!patch) {
      continue;
    }
    resolved = {
      ...resolved,
      [property]: deepMerge(
        resolved[property] as Record<string, unknown>,
        patch,
      ) as ResolvedSystemSettings[typeof property],
    };
  }
  return resolved;
};

const settingsPlugin = fp(async (app: FastifyInstance) => {
  let current = defaultSettings();
  const getPrisma = () =>
    (app as FastifyInstance & { prisma?: Partial<ExtendedPrismaClient> }).prisma;

  const hasSystemSettingModel = (
    client: Partial<ExtendedPrismaClient> | undefined,
  ): client is ExtendedPrismaClient => {
    const delegate = client?.systemSetting;
    if (!delegate) {
      return false;
    }
    return (
      typeof delegate.findMany === "function" &&
      typeof delegate.upsert === "function"
    );
  };

  const load = async () => {
    const prisma = getPrisma();
    if (!hasSystemSettingModel(prisma)) {
      current = defaultSettings();
      return current;
    }

    const rows = await prisma.systemSetting.findMany();
    const overrides: Partial<
      Record<keyof ResolvedSystemSettings, Record<string, unknown>>
    > = {};

    for (const row of rows) {
      const key = row.key as SettingKey;
      const schema = schemaByKey[key];
      const property = keyToProperty[key];
      if (!schema || !property) {
        continue;
      }
      try {
        const parsed = schema.parse(row.value ?? {});
        overrides[property] = {
          ...(overrides[property] ?? {}),
          ...(parsed as Record<string, unknown>),
        };
      } catch (error) {
        app.log.warn(
          {
            event: "settings.override.invalid",
            key: row.key,
            error: error instanceof Error ? error.message : String(error),
          },
          "Ignoring invalid system setting override",
        );
      }
    }

    current = applyOverrides(
      overrides as Record<
        keyof ResolvedSystemSettings,
        Record<string, unknown>
      >,
    );
    return current;
  };

  await load();

  app.addHook("onReady", async () => {
    await load();
  });

  const save = async (
    payload: SettingsUpdatePayload,
    actorId?: string,
  ): Promise<void> => {
    const prisma = getPrisma();
    if (!hasSystemSettingModel(prisma)) {
      throw new Error("Prisma client not available for saving settings");
    }

    const writes: Promise<unknown>[] = [];

    for (const [property, value] of Object.entries(payload) as [
      keyof ResolvedSystemSettings,
      unknown,
    ][]) {
      if (value === undefined) {
        continue;
      }
      const key = (Object.entries(keyToProperty).find(
        ([, prop]) => prop === property,
      )?.[0] ?? null) as SettingKey | null;
      if (!key) {
        continue;
      }
      const schema = schemaByKey[key];
      const parsed = schema.parse(value);
      writes.push(
        prisma.systemSetting.upsert({
          where: { key },
          create: {
            key,
            value: parsed as Record<string, unknown>,
            updatedById: actorId,
          },
          update: {
            value: parsed as Record<string, unknown>,
            updatedById: actorId,
          },
        }),
      );
    }

    await Promise.all(writes);
  };

  app.decorate<SettingsManager>("settings", {
    get: () => current,
    reload: async () => load(),
    update: async (payload, options) => {
      await save(payload, options?.actorId);
      await load();
      return current;
    },
  });
});

export default settingsPlugin;
