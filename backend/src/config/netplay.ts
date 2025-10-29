import { env } from "./env.js";

export type NetplayConfig = {
  baseUrl: string;
  apiKey: string;
  ttl: {
    minMinutes: number;
    maxMinutes: number;
    defaultMinutes: number;
  };
  cleanupCadenceMs: number;
  codeLength: number;
  codeAlphabet: string;
};

export const loadNetplayConfig = (): NetplayConfig => ({
  baseUrl: env.NETPLAY_BASE_URL,
  apiKey: env.NETPLAY_API_KEY,
  ttl: {
    minMinutes: env.NETPLAY_SESSION_TTL_MIN_MINUTES,
    maxMinutes: env.NETPLAY_SESSION_TTL_MAX_MINUTES,
    defaultMinutes: env.NETPLAY_SESSION_DEFAULT_TTL_MINUTES
  },
  cleanupCadenceMs: env.NETPLAY_SESSION_CLEANUP_INTERVAL_MS,
  codeLength: 6,
  codeAlphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
});

export const netplayConfig = loadNetplayConfig();
