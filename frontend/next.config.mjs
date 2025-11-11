import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSecurityHeaders } from "./security-headers.mjs";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const AUTH_API_BASE_URL =
  process.env.AUTH_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

/** @type {import("next").NextConfig} */
const imageRemotePatterns = [
  {
    protocol: "https",
    hostname: "assets.treazris.land",
    pathname: "/**"
  }
];

try {
  const apiUrl = new URL(AUTH_API_BASE_URL);
  const protocol = apiUrl.protocol.replace(":", "");

  if ((protocol === "http" || protocol === "https") && apiUrl.hostname) {
    const pattern = {
      protocol,
      hostname: apiUrl.hostname,
      pathname: "/**",
      ...(apiUrl.port ? { port: apiUrl.port } : {})
    };

    const hasPattern = imageRemotePatterns.some((existing) => {
      return (
        existing.protocol === pattern.protocol &&
        existing.hostname === pattern.hostname &&
        (existing.port ?? "") === (pattern.port ?? "")
      );
    });

    if (!hasPattern) {
      imageRemotePatterns.push(pattern);
    }
  }
} catch {
  // Ignore malformed AUTH_API_BASE_URL values and fall back to default patterns
}

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
    AUTH_API_BASE_URL
  },
  images: {
    remotePatterns: imageRemotePatterns
  },
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

    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(projectRoot),
      "@admin": path.resolve(projectRoot, "src/admin"),
      "@auth": path.resolve(projectRoot, "src/auth"),
      "@components": path.resolve(projectRoot, "src/components"),
      "@lib": path.resolve(projectRoot, "src/lib"),
      "@onboarding": path.resolve(projectRoot, "src/onboarding")
    };

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
