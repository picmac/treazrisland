import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SEGMENT_LENGTH = 3;
const SEGMENT_COUNT = 2;

export const NETPLAY_JOIN_CODE_REGEX = /^[A-Z2-9]{3}-[A-Z2-9]{3}$/;

export const generateNetplayJoinCode = (): string => {
  const segments: string[] = [];

  for (let segmentIndex = 0; segmentIndex < SEGMENT_COUNT; segmentIndex += 1) {
    let segment = "";

    for (let charIndex = 0; charIndex < SEGMENT_LENGTH; charIndex += 1) {
      const randomIndex = randomInt(ALPHABET.length);
      segment += ALPHABET[randomIndex];
    }

    segments.push(segment);
  }

  return segments.join("-");
};

export const isValidNetplayJoinCode = (value: string): boolean => {
  return NETPLAY_JOIN_CODE_REGEX.test(value);
};

export const normaliseNetplayJoinCode = (value: string): string => {
  return value.trim().toUpperCase();
};
