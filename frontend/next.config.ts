import type { NextConfig } from "next";

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { buildSecurityHeaders } from "./security-headers";

const repoRootEnvPath = resolve(process.cwd(), "../.env");
if (existsSync(repoRootEnvPath)) {
  loadEnv({ path: repoRootEnvPath });
}

const localEnvPath = resolve(process.cwd(), ".env");
if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath });
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  turbopack: {},
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true
    };

    config.module.rules.push({
      test: /\.wasm$/i,
      type: "asset/resource"
    });

    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders()
      }
    ];
  }
};

export default nextConfig;
