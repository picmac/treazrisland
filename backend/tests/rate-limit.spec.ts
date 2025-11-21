import './setup-env';

import type { FastifyInstance, RouteOptions } from 'fastify';
import { describe, expect, it } from 'vitest';

import { createRateLimitHook, strictRateLimitBuckets } from '../src/config/rate-limit';

const fakeInstance = {} as FastifyInstance;

type RouteRegistration = RouteOptions & { routePath: string; path: string; prefix: string };

const buildRoute = (url: string): RouteRegistration => ({
  method: 'POST',
  url,
  handler: async () => undefined,
  routePath: url,
  path: url,
  prefix: '',
});

describe('rate limit hook', () => {
  it('applies the strict uploads bucket to save state upload routes', () => {
    const applyRateLimitConfig = createRateLimitHook();

    const saveStateRoute = buildRoute('/roms/:id/save-state');
    const saveStatesRoute = buildRoute('/roms/:id/save-states');

    applyRateLimitConfig.call(fakeInstance, saveStateRoute);
    applyRateLimitConfig.call(fakeInstance, saveStatesRoute);

    expect(saveStateRoute.config?.rateLimit).toMatchObject(strictRateLimitBuckets.uploads);
    expect(saveStatesRoute.config?.rateLimit).toMatchObject(strictRateLimitBuckets.uploads);
  });
});
