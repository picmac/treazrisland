#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { encryptWithAesGcm } from "../src/utils/crypto.js";

type ArgMap = Record<string, string | undefined>;

const parseArgs = (argv: string[]): ArgMap => {
  return argv.reduce<ArgMap>((acc, arg) => {
    const [key, ...rest] = arg.split("=");
    if (key.startsWith("--")) {
      acc[key.replace(/^--/, "")] = rest.join("=") || "";
    }
    return acc;
  }, {});
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const secret = args.secret || process.env.SCREENSCRAPER_SECRET_KEY;

  if (!secret) {
    console.error("Missing encryption secret. Provide via --secret or SCREENSCRAPER_SECRET_KEY env var.");
    process.exitCode = 1;
    return;
  }

  let value = args.value;
  if (!value) {
    const rl = createInterface({ input, output });
    value = await rl.question("Value to encrypt: ");
    rl.close();
  }

  if (!value) {
    console.error("No value provided for encryption");
    process.exitCode = 1;
    return;
  }

  try {
    const encrypted = encryptWithAesGcm(value, secret);
    console.log(encrypted);
  } catch (error) {
    console.error(`Failed to encrypt value: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

await main();
