import { createHash } from 'node:crypto';

import { Prisma, SessionStatus, type PrismaClient } from '@prisma/client';

import type { AuthUser } from '../modules/auth/types';

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const buildExpiry = (ttlSeconds: number): Date => new Date(Date.now() + ttlSeconds * 1000);

export class PrismaSessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: { refreshTokenTtlSeconds: number },
  ) {}

  async recordSession(sessionId: string, userId: string, refreshToken: string): Promise<void> {
    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        sessionToken: hashToken(refreshToken),
        status: SessionStatus.ACTIVE,
        expiresAt: buildExpiry(this.config.refreshTokenTtlSeconds),
      },
    });
  }

  async revokeSession(
    sessionId: string,
    status: SessionStatus = SessionStatus.REVOKED,
  ): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { status, revokedAt: new Date() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return;
      }

      throw error;
    }
  }

  async consumeSession(sessionId: string, refreshToken: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { id: true, email: true, isAdmin: true } },
      },
    });

    if (!session || session.status !== SessionStatus.ACTIVE) {
      return null;
    }

    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      await this.revokeSession(sessionId, SessionStatus.EXPIRED);
      return null;
    }

    if (session.sessionToken !== hashToken(refreshToken)) {
      return null;
    }

    await this.revokeSession(sessionId, SessionStatus.REVOKED);
    return session.user;
  }
}
