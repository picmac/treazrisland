import { expect, type APIRequestContext } from '@playwright/test';

import { backendBaseUrl } from './env';

export async function ensureFirstAdminBootstrapped(request: APIRequestContext) {
  const statusResponse = await request.get(`${backendBaseUrl}/auth/bootstrap/status`);
  expect(statusResponse.ok()).toBeTruthy();
  const statusPayload = (await statusResponse.json()) as { needsBootstrap: boolean };

  if (!statusPayload.needsBootstrap) {
    return { created: false } as const;
  }

  const bootstrapResponse = await request.post(`${backendBaseUrl}/auth/bootstrap`);
  expect([201, 409]).toContain(bootstrapResponse.status());

  if (bootstrapResponse.status() === 201) {
    const bootstrapPayload = (await bootstrapResponse.json()) as {
      user: { id: string; email: string };
    };

    return { created: true, user: bootstrapPayload.user } as const;
  }

  return { created: false } as const;
}

export async function createInviteCode(
  request: APIRequestContext,
  adminToken: string,
  email: string,
  expiresInDays = 7,
) {
  const inviteResponse = await request.post(`${backendBaseUrl}/auth/invitations`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email, expiresInDays },
  });

  expect(inviteResponse.ok()).toBeTruthy();
  const invitePayload = (await inviteResponse.json()) as { code: string };
  return invitePayload.code;
}
