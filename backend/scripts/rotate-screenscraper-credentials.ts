#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { encryptWithAesGcm } from "../src/utils/crypto.js";

type ArgMap = Record<string, string | undefined>;

type RotationInput = {
  username: string;
  password: string;
  developerId: string;
  developerPassword: string;
  secretKey: string;
};

const ARG_ALIASES: Record<string, keyof RotationInput> = {
  username: "username",
  password: "password",
  devId: "developerId",
  "dev-id": "developerId",
  devPassword: "developerPassword",
  "dev-password": "developerPassword",
  secret: "secretKey",
  "secret-key": "secretKey",
};

function parseArgs(argv: string[]): ArgMap {
  return argv.reduce<ArgMap>((acc, arg) => {
    const [key, ...rest] = arg.split("=");
    if (key.startsWith("--")) {
      acc[key.slice(2)] = rest.join("=") || "";
    }
    return acc;
  }, {});
}

async function promptForValue(prompt: string): Promise<string> {
  const rl = createInterface({ input, output });
  const value = await rl.question(prompt);
  await rl.close();
  return value.trim();
}

function resolveInput(args: ArgMap): Partial<RotationInput> & { secretKey: string } {
  const secretKey = args.secretKey || process.env.SCREENSCRAPER_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Missing encryption secret. Provide via --secret-key or SCREENSCRAPER_SECRET_KEY env var.",
    );
  }

  const rotation: Partial<RotationInput> & { secretKey: string } = { secretKey };
  for (const [argKey, field] of Object.entries(ARG_ALIASES)) {
    if (args[argKey]) {
      rotation[field] = args[argKey];
    }
  }

  return rotation;
}

async function gatherRotationInput(args: ArgMap): Promise<RotationInput> {
  const base = resolveInput(args);
  const rotation = { ...base };

  if (!rotation.username) {
    rotation.username = await promptForValue("New ScreenScraper username: ");
  }
  if (!rotation.password) {
    rotation.password = await promptForValue("New ScreenScraper password: ");
  }
  if (!rotation.developerId) {
    rotation.developerId = await promptForValue("New developer ID: ");
  }
  if (!rotation.developerPassword) {
    rotation.developerPassword = await promptForValue("New developer password: ");
  }

  const missing = Object.entries(rotation).filter(([, value]) => !value);
  if (missing.length > 0) {
    const keys = missing.map(([key]) => key).join(", ");
    throw new Error(`Missing required values: ${keys}`);
  }

  return rotation as RotationInput;
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const rotation = await gatherRotationInput(args);

    const encryptedDevId = encryptWithAesGcm(rotation.developerId, rotation.secretKey);
    const encryptedDevPassword = encryptWithAesGcm(
      rotation.developerPassword,
      rotation.secretKey,
    );

    const summary = `Rotation summary\n=================\nSCREENSCRAPER_USERNAME=${rotation.username}\nSCREENSCRAPER_PASSWORD=${rotation.password}\nSCREENSCRAPER_DEV_ID_ENC=${encryptedDevId}\nSCREENSCRAPER_DEV_PASSWORD_ENC=${encryptedDevPassword}\n`;

    const nextSteps = `Next steps\n==========\n1. Update the shared secret manager with the values above.\n2. Redeploy the backend so the new credentials take effect.\n3. Run the metadata enrichment smoke test to confirm ScreenScraper lookups still succeed.\n4. Revoke the previous ScreenScraper credentials once validation passes.`;

    console.log(summary);
    console.log(nextSteps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Rotation aborted: ${message}`);
    process.exitCode = 1;
  }
}

await main();
