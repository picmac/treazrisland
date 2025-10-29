import { env } from "./env.js";

export type NetplaySignalingConfig = {
  baseUrl: string;
  apiKey: string;
};

export type NetplayConfig = {
  defaultTtlMs: number;
  minTtlMs: number;
  maxTtlMs: number;
  cleanupIntervalMs: number;
  codeLength: number;
  codeAlphabet: string;
  signaling?: NetplaySignalingConfig;
};

const DEFAULT_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const DEFAULT_CODE_LENGTH = 6;

export const loadNetplayConfig = (): NetplayConfig => {
  const config: NetplayConfig = {
    defaultTtlMs: env.NETPLAY_DEFAULT_TTL_MS,
    minTtlMs: env.NETPLAY_MIN_TTL_MS,
    maxTtlMs: env.NETPLAY_MAX_TTL_MS,
    cleanupIntervalMs: env.NETPLAY_CLEANUP_INTERVAL_MS,
    codeLength: DEFAULT_CODE_LENGTH,
    codeAlphabet: DEFAULT_CODE_ALPHABET
  };

  if (env.NETPLAY_BASE_URL && env.NETPLAY_API_KEY) {
    config.signaling = {
      baseUrl: env.NETPLAY_BASE_URL,
      apiKey: env.NETPLAY_API_KEY
    };
  }

  return config;
};

export const netplayConfig = loadNetplayConfig();
