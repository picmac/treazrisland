import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/observability', () => ({
  incrementActiveSessions: vi.fn(),
  decrementActiveSessions: vi.fn(),
}));

import {
  decrementActiveSessions,
  incrementActiveSessions,
} from '../../../src/config/observability';
import { RedisSessionStore } from '../../../src/modules/auth/session-store';
import type { AuthUser } from '../../../src/modules/auth/types';

describe('RedisSessionStore', () => {
  const user: AuthUser = { id: 'user-1', email: 'player@example.com', isAdmin: true };
  const backingStore = new Map<string, string>();

  const get = vi.fn(async (key: string) => backingStore.get(key) ?? null);
  const set = vi.fn(async (...args: unknown[]) => {
    const [key, value] = args as [string, string];
    backingStore.set(key, value);
    return 'OK';
  });
  const del = vi.fn(async (key: string) => (backingStore.delete(key) ? 1 : 0));

  const createStore = () =>
    new RedisSessionStore(
      { get, set, del } as unknown as ConstructorParameters<typeof RedisSessionStore>[0],
      { refreshTokenTtlSeconds: 3600, magicLinkTokenTtlSeconds: 600 },
    );

  beforeEach(() => {
    backingStore.clear();
    vi.clearAllMocks();
  });

  it('creates refresh sessions and returns sanitized payloads', async () => {
    const store = createStore();

    await store.createRefreshSession('session-123', user);

    expect(incrementActiveSessions).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.stringContaining('auth:refresh:'),
      expect.any(String),
      'EX',
      3600,
    );

    const loadedUser = await store.getRefreshSession('session-123');
    expect(loadedUser).toEqual({ id: user.id, email: user.email, isAdmin: true });
  });

  it('ignores malformed refresh payloads without throwing', async () => {
    backingStore.set('auth:refresh:corrupt', '{not-json');
    const store = createStore();

    await expect(store.getRefreshSession('corrupt')).resolves.toBeNull();
  });

  it('persists and consumes magic link tokens once', async () => {
    const store = createStore();

    await store.saveMagicLinkToken('magic-1', user);

    const consumed = await store.consumeMagicLinkToken('magic-1');
    expect(consumed).toEqual(user);
    expect(await store.consumeMagicLinkToken('magic-1')).toBeNull();
    expect(del).toHaveBeenCalledWith('auth:magic:magic-1');
  });

  it('deletes refresh sessions and records metric updates', async () => {
    const store = createStore();
    await store.createRefreshSession('session-999', user);

    await store.deleteRefreshSession('session-999');

    expect(decrementActiveSessions).toHaveBeenCalledTimes(1);
    expect(await store.getRefreshSession('session-999')).toBeNull();
  });

  it('renews existing refresh sessions without incrementing metrics', async () => {
    const store = createStore();
    const sessionId = 'session-renew';

    await store.createRefreshSession(sessionId, user);

    const key = `auth:refresh:${sessionId}`;
    const originalPayload = backingStore.get(key);

    vi.clearAllMocks();

    await store.renewRefreshSession(sessionId, { ...user, email: 'new-email@example.com' });

    expect(incrementActiveSessions).not.toHaveBeenCalled();
    expect(backingStore.get(key)).toBe(originalPayload);
    expect(set).toHaveBeenCalledWith(key, originalPayload, 'EX', 3600);
  });

  it('creates a refresh session when renewing a missing one and increments metrics', async () => {
    const store = createStore();
    const sessionId = 'missing-session';

    await store.renewRefreshSession(sessionId, user);

    expect(incrementActiveSessions).toHaveBeenCalledTimes(1);

    const storedPayload = backingStore.get(`auth:refresh:${sessionId}`);
    expect(storedPayload).toBeDefined();
    expect(JSON.parse(storedPayload as string)).toEqual({ user });
    expect(set).toHaveBeenCalledWith(`auth:refresh:${sessionId}`, expect.any(String), 'EX', 3600);
  });
});
