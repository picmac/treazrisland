import { env } from "./env.js";
import { decryptWithAesGcm } from "../utils/crypto.js";

export type ScreenScraperConfig = {
  baseUrl: string;
  username?: string;
  password?: string;
  devId?: string;
  devPassword?: string;
  requestsPerMinute: number;
  concurrency: number;
  timeoutMs: number;
  languagePriority: string[];
  regionPriority: string[];
  mediaTypes: string[];
  onlyBetterMedia: boolean;
  maxAssetsPerType: number;
  diagnostics: {
    encryptionConfigured: boolean;
    decryptionErrors: string[];
    missingUserCredentials: boolean;
    missingDeveloperCredentials: boolean;
  };
};

const tryDecrypt = (payload: string | undefined, secret: string | undefined, label: string, errors: string[]): string | undefined => {
  if (!payload) {
    return undefined;
  }

  if (!secret) {
    errors.push(`Missing SCREENSCRAPER_SECRET_KEY required to decrypt ${label}`);
    return undefined;
  }

  try {
    return decryptWithAesGcm(payload, secret);
  } catch (error) {
    errors.push(`Failed to decrypt ${label}: ${(error as Error).message}`);
    return undefined;
  }
};

export const loadScreenScraperConfig = (): ScreenScraperConfig => {
  const decryptionErrors: string[] = [];
  const secretKey = env.SCREENSCRAPER_SECRET_KEY;

  const devId = tryDecrypt(env.SCREENSCRAPER_DEV_ID_ENC, secretKey, "developer id", decryptionErrors);
  const devPassword = tryDecrypt(
    env.SCREENSCRAPER_DEV_PASSWORD_ENC,
    secretKey,
    "developer password",
    decryptionErrors
  );

  const username = env.SCREENSCRAPER_USERNAME;
  const password = env.SCREENSCRAPER_PASSWORD;

  return {
    baseUrl: env.SCREENSCRAPER_BASE_URL,
    username,
    password,
    devId,
    devPassword,
    requestsPerMinute: env.SCREENSCRAPER_REQUESTS_PER_MINUTE,
    concurrency: env.SCREENSCRAPER_CONCURRENCY,
    timeoutMs: env.SCREENSCRAPER_TIMEOUT_MS,
    languagePriority: env.SCREENSCRAPER_DEFAULT_LANGUAGE_PRIORITY,
    regionPriority: env.SCREENSCRAPER_DEFAULT_REGION_PRIORITY,
    mediaTypes: env.SCREENSCRAPER_DEFAULT_MEDIA_TYPES,
    onlyBetterMedia: env.SCREENSCRAPER_ONLY_BETTER_MEDIA,
    maxAssetsPerType: env.SCREENSCRAPER_MAX_ASSETS_PER_TYPE,
    diagnostics: {
      encryptionConfigured: Boolean(secretKey),
      decryptionErrors,
      missingUserCredentials: !(username && password),
      missingDeveloperCredentials: !(devId && devPassword)
    }
  };
};

export const screenScraperConfig = loadScreenScraperConfig();
