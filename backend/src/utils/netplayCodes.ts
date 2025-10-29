import { randomInt } from "node:crypto";

export const NETPLAY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const NETPLAY_CODE_LENGTH = 6;
export const NETPLAY_CODE_REGEX = new RegExp(
  `^[${NETPLAY_CODE_ALPHABET}]{${NETPLAY_CODE_LENGTH}}$`
);

export const normalizeNetplayJoinCode = (value: string): string => value.trim().toUpperCase();

export const isValidNetplayJoinCode = (value: string): boolean =>
  NETPLAY_CODE_REGEX.test(value);

export const generateNetplayJoinCode = (): string => {
  let code = "";
  for (let i = 0; i < NETPLAY_CODE_LENGTH; i += 1) {
    const index = randomInt(0, NETPLAY_CODE_ALPHABET.length);
    code += NETPLAY_CODE_ALPHABET[index];
  }
  return code;
};
