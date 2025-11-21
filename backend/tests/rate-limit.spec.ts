import './setup-env';

import type { FastifyRouteOptions } from 'fastify';
import { describe, expect, it } from 'vitest';

import { createRateLimitHook, strictRateLimitBuckets } from '../src/config/rate-limit';

const buildRoute = (url: string): FastifyRouteOptions => ({ method: 'POST', url });

describe('rate limit hook', () => {
  it('applies the strict uploads bucket to save state upload routes', () => {
    const applyRateLimitConfig = createRateLimitHook();

    const saveStateRoute = buildRoute('/roms/:id/save-state');
    const saveStatesRoute = buildRoute('/roms/:id/save-states');

    applyRateLimitConfig(saveStateRoute);
    applyRateLimitConfig(saveStatesRoute);

    expect(saveStateRoute.config?.rateLimit).toMatchObject(strictRateLimitBuckets.uploads);
    expect(saveStatesRoute.config?.rateLimit).toMatchObject(strictRateLimitBuckets.uploads);
  });
});
