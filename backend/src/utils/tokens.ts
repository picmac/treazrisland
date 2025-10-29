import type { Prisma, Role, User } from "@prisma/client";
import { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

export const REFRESH_COOKIE_NAME = "treaz_refresh";

export class RefreshTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefreshTokenError";
  }
}

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

type TransactionClient = Prisma.TransactionClient;

type SessionIssueOptions = {
  familyId?: string;
  tx?: TransactionClient;
};

export interface SessionTokensResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  familyId: string;
}

const getPrisma = (app: FastifyInstance, tx?: TransactionClient) => tx ?? app.prisma;

export async function issueSessionTokens(
  app: FastifyInstance,
  userId: string,
  role: Role,
  options: SessionIssueOptions = {}
): Promise<SessionTokensResult> {
  const prisma = getPrisma(app, options.tx);

  let familyId = options.familyId;
  if (!familyId) {
    const family = await prisma.refreshTokenFamily.create({
      data: { userId }
    });
    familyId = family.id;
  }

  const accessToken = app.jwt.sign({
    sub: userId,
    role
  });

  const refreshToken = randomBytes(48).toString("hex");
  const refreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_MS);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId,
      familyId,
      expiresAt: refreshExpiresAt
    }
  });

  return {
    accessToken,
    refreshToken,
    refreshExpiresAt,
    familyId
  };
}

type RefreshTokenWithRelations = {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  family: {
    id: string;
    revokedAt: Date | null;
    revokedReason: string | null;
  };
  user: Pick<User, "id" | "email" | "nickname" | "role">;
};

export async function rotateRefreshToken(
  app: FastifyInstance,
  refreshToken: string
): Promise<SessionTokensResult & { user: Pick<User, "id" | "email" | "nickname" | "role"> }> {
  const tokenHash = hashToken(refreshToken);
  const now = new Date();

  return app.prisma.$transaction(async (tx) => {
    const existing = (await tx.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        family: true,
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            role: true
          }
        }
      }
    })) as RefreshTokenWithRelations | null;

    if (!existing) {
      throw new RefreshTokenError("INVALID_REFRESH_TOKEN");
    }

    if (existing.revokedAt || existing.family.revokedAt || existing.expiresAt <= now) {
      if (!existing.revokedAt) {
        await tx.refreshToken.update({
          where: { id: existing.id },
          data: {
            revokedAt: now,
            revokedReason: existing.family.revokedAt ? "family_revoked" : "expired"
          }
        });
      }
      throw new RefreshTokenError("INVALID_REFRESH_TOKEN");
    }

    await tx.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: now,
        revokedReason: "rotated"
      }
    });

    const tokens = await issueSessionTokens(app, existing.userId, existing.user.role, {
      tx,
      familyId: existing.familyId
    });

    return {
      ...tokens,
      user: existing.user
    };
  });
}

const revokeFamilySet = async (
  client: Prisma.TransactionClient,
  familyIds: string[],
  reason: string
) => {
  if (familyIds.length === 0) {
    return;
  }

  const now = new Date();

  await client.refreshTokenFamily.updateMany({
    where: { id: { in: familyIds }, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason }
  });

  await client.refreshToken.updateMany({
    where: { familyId: { in: familyIds }, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason }
  });
};

export async function revokeRefreshFamily(
  app: FastifyInstance,
  familyId: string,
  reason = "revoked",
  tx?: TransactionClient
): Promise<void> {
  const executor = async (client: TransactionClient) => {
    await revokeFamilySet(client, [familyId], reason);
  };

  if (tx) {
    await executor(tx);
  } else {
    await app.prisma.$transaction(async (client) => executor(client));
  }
}

export async function revokeUserRefreshFamilies(
  app: FastifyInstance,
  userId: string,
  reason = "revoked",
  tx?: TransactionClient
): Promise<void> {
  const executor = async (client: TransactionClient) => {
    const families = await client.refreshTokenFamily.findMany({
      where: { userId, revokedAt: null },
      select: { id: true }
    });

    if (families.length === 0) {
      return;
    }

    const ids = families.map((family) => family.id);
    await revokeFamilySet(client, ids, reason);
  };

  if (tx) {
    await executor(tx);
  } else {
    await app.prisma.$transaction(async (client) => executor(client));
  }
}
