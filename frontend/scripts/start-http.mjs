#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.join(__dirname, "..");
const env = { ...process.env };

const isGitHubActions = env.GITHUB_ACTIONS === "true";

if (isGitHubActions) {
  if (env.TREAZ_TLS_MODE && env.TREAZ_TLS_MODE.trim().length > 0) {
    const normalized = env.TREAZ_TLS_MODE.trim().toLowerCase();
    if (normalized !== "http") {
      console.log(
        `[start-http] Overriding TREAZ_TLS_MODE=${env.TREAZ_TLS_MODE} for GitHub Actions runner preview.`
      );
    }
  }
  env.TREAZ_TLS_MODE = "http";
} else if (!env.TREAZ_TLS_MODE || env.TREAZ_TLS_MODE.trim().length === 0) {
  env.TREAZ_TLS_MODE = "http";
}

const defaultHostname = "0.0.0.0";
const port = env.PORT && env.PORT.trim().length > 0 ? env.PORT.trim() : undefined;
const hostnameCandidate =
  env.NEXT_HOSTNAME && env.NEXT_HOSTNAME.trim().length > 0
    ? env.NEXT_HOSTNAME.trim()
    : env.HOST && env.HOST.trim().length > 0
      ? env.HOST.trim()
      : defaultHostname;

const extraArgs = process.argv.slice(2);
const hasHostnameFlag = extraArgs.some((value) =>
  value === "--hostname" ||
  value === "--host" ||
  value === "-H" ||
  value === "-h" ||
  value.startsWith("--hostname=") ||
  value.startsWith("--host=") ||
  value.startsWith("-H") ||
  value.startsWith("-h")
);

const hasPortFlag = extraArgs.some((value) =>
  value === "--port" ||
  value === "-p" ||
  value.startsWith("--port=") ||
  value.startsWith("-p")
);

const args = ["start"];

if (!hasHostnameFlag) {
  args.push("--hostname", hostnameCandidate);
}

if (!hasPortFlag && port) {
  args.push("--port", port);
}

env.HOST = hostnameCandidate;

env.TREAZ_TLS_MODE = env.TREAZ_TLS_MODE.toLowerCase();

console.log(
  `[start-http] Starting Next.js on http://${hostnameCandidate}:${port ?? "3000"} (TREAZ_TLS_MODE=${env.TREAZ_TLS_MODE})`
);

const nextBinary = path.join(
  frontendRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

const child = spawn(nextBinary, [...args, ...extraArgs], {
  cwd: frontendRoot,
  env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  } else {
    process.exit(code ?? 0);
  }
});

child.on("error", (error) => {
  console.error("[start-http] Failed to launch Next.js:", error);
  process.exit(1);
});
