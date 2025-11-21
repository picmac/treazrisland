import type { FastifyRouteOptions, OnRouteHookHandler } from 'fastify';

type RateLimitBucket = { max: number; timeWindow: string };

export const strictRateLimitBuckets = {
  auth: { max: 15, timeWindow: '1 minute' },
  uploads: { max: 5, timeWindow: '1 minute' },
} as const satisfies Record<string, RateLimitBucket>;

export const uploadRouteMatchers = [
  /^\/roms\/:id\/save-state$/,
  /^\/roms\/:id\/save-states$/,
  /^\/admin\/roms$/,
  /^\/admin\/roms\/uploads$/,
  /^\/users\/me\/avatar-upload$/,
];

const extractMethods = (method: FastifyRouteOptions['method']): string[] =>
  (Array.isArray(method) ? method : method ? [method] : []).filter(
    (candidate): candidate is string => typeof candidate === 'string',
  );

const applyBucket = (routeOptions: FastifyRouteOptions, bucket: RateLimitBucket) => {
  const existingConfig = routeOptions.config ?? {};
  const existingRateLimit =
    (existingConfig as { rateLimit?: Record<string, unknown> }).rateLimit ?? {};

  routeOptions.config = {
    ...existingConfig,
    rateLimit: {
      ...existingRateLimit,
      ...bucket,
    },
  };
};

export const createRateLimitHook = (
  buckets: typeof strictRateLimitBuckets = strictRateLimitBuckets,
  matchers: RegExp[] = uploadRouteMatchers,
): OnRouteHookHandler => {
  return (routeOptions) => {
    const url = routeOptions.url ?? '';
    const methods = extractMethods(routeOptions.method);

    if (url.startsWith('/auth')) {
      applyBucket(routeOptions, buckets.auth);
      return;
    }

    const isUploadRoute = methods.includes('POST') && matchers.some((matcher) => matcher.test(url));

    if (isUploadRoute) {
      applyBucket(routeOptions, buckets.uploads);
    }
  };
};
