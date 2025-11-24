import type { PrismaClient } from '@prisma/client';

export const needsAdminBootstrap = async (prisma: PrismaClient): Promise<boolean> => {
  const adminCount = await prisma.user.count({ where: { isAdmin: true } });
  return adminCount === 0;
};

export const assertAdminBootstrapComplete = async (
  prisma: PrismaClient,
): Promise<{ allowed: boolean; reason?: string }> => {
  const needsBootstrap = await needsAdminBootstrap(prisma);

  if (needsBootstrap) {
    return { allowed: false, reason: 'First admin must be created via /auth/bootstrap' };
  }

  return { allowed: true };
};
