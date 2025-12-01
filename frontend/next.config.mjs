const normalizeBaseUrl = (value) => value.replace(/\/$/, '');

const apiProxyTarget = process.env.NEXT_INTERNAL_API_BASE_URL ?? 'http://localhost:4000';
const emulatorProxyTarget = process.env.EMULATORJS_BASE_URL ?? 'http://emulatorjs:80';
const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS
  ? process.env.NEXT_ALLOWED_DEV_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)
  : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    ...(allowedDevOrigins.length ? { allowedDevOrigins } : {})
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'minio',
        port: '9000'
      }
    ]
  },
  async rewrites() {
    const rules = [];

    if (apiProxyTarget) {
      rules.push({
        source: '/api/:path*',
        destination: `${normalizeBaseUrl(apiProxyTarget)}/:path*`
      });
    }

    if (emulatorProxyTarget) {
      rules.push({
        source: '/emulatorjs/:path*',
        destination: `${normalizeBaseUrl(emulatorProxyTarget)}/:path*`
      });
    }

    return rules;
  }
};

export default nextConfig;
