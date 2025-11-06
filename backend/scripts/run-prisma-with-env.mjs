#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { config as loadEnv } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = dirname(__filename);
const backendRoot = resolve(scriptsDir, "..");
const repoRoot = resolve(backendRoot, "..");

const candidateEnvPaths = [
  process.env.TREAZ_ENV_FILE
    ? resolve(backendRoot, process.env.TREAZ_ENV_FILE)
    : undefined,
  resolve(repoRoot, ".env"),
  resolve(backendRoot, ".env"),
].filter((value) => Boolean(value));

const loadedPaths = new Set();

for (const envPath of candidateEnvPaths) {
  if (loadedPaths.has(envPath)) {
    continue;
  }

  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
    loadedPaths.add(envPath);
  }
}

const prismaArgs = process.argv.slice(2);

if (prismaArgs.length === 0) {
  console.error(
    "Usage: node ./scripts/run-prisma-with-env.mjs <prisma-commands...>",
  );
  process.exit(1);
}

const prismaExecutable =
  process.platform === "win32"
    ? resolve(backendRoot, "node_modules/.bin/prisma.cmd")
    : resolve(backendRoot, "node_modules/.bin/prisma");

const subprocess = spawn(prismaExecutable, prismaArgs, {
  stdio: "inherit",
  env: process.env,
});

subprocess.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

subprocess.on("error", (error) => {
  console.error("Failed to run Prisma CLI", error);
  process.exit(1);
});
