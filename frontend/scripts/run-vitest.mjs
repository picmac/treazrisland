#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const argv = process.argv.slice(2);
const sanitizedArgs = [];
const extraArgs = [];
let sawRunInBand = false;

for (const arg of argv) {
  if (arg === "--runInBand" || arg === "--run-in-band") {
    if (!sawRunInBand) {
      sawRunInBand = true;
      extraArgs.push("--maxWorkers=1", "--maxConcurrency=1", "--no-file-parallelism");
    }
    continue;
  }

  sanitizedArgs.push(arg);
}

const vitestBin = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../node_modules/vitest/vitest.mjs"
);

const child = spawn(process.execPath, [vitestBin, "run", ...sanitizedArgs, ...extraArgs], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
