const normalizeBaseUrl = (value) => value.replace(/\/$/, '');

const apiProxyTarget = process.env.NEXT_INTERNAL_API_BASE_URL ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
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
    if (!apiProxyTarget) {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: `${normalizeBaseUrl(apiProxyTarget)}/:path*`
      }
    ];
  }
};

export default nextConfig;
