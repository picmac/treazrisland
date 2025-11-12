import '../../setup-env';

import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/index';
import { invitationRepository } from '../../../src/services/invitations';
import { InMemoryInvitationRepository } from '../../../src/services/invitations/in-memory-repository';

const isInMemoryRepository = (
  repository: unknown,
): repository is InMemoryInvitationRepository => repository instanceof InMemoryInvitationRepository;

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  if (isInMemoryRepository(invitationRepository)) {
    invitationRepository.clear();
  }

  app = createApp();
});

afterEach(async () => {
  await app.close();
});

describe('POST /admin/invitations', () => {
  it('creates an invitation and returns the token', async () => {
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/admin/invitations',
      payload: {
        email: 'captain@example.com',
        expiresInHours: 12,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { token: string; email: string; inviteUrl: string };

    expect(body.token).toBeTypeOf('string');
    expect(body.email).toBe('captain@example.com');
    expect(body.inviteUrl).toContain(body.token);

    if (isInMemoryRepository(invitationRepository)) {
      const record = invitationRepository.list()[0];
      const expectedHash = createHash('sha256').update(body.token).digest('hex');
      expect(record.tokenHash).toBe(expectedHash);
      expect(record.tokenHash).not.toBe(body.token);
    }
  });

  it('rejects invalid payloads', async () => {
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/admin/invitations',
      payload: {
        email: 'not-an-email',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
