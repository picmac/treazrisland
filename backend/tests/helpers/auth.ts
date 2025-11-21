import bcrypt from 'bcryptjs';
import type { PrismaClient, User } from '@prisma/client';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const buildUsername = (email: string): string => {
  const [localPart] = email.split('@');
  const sanitized = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return sanitized.length > 0 ? sanitized.slice(0, 24) : 'player';
};

export const ensureUserWithPassword = async (
  prisma: PrismaClient,
  email: string,
  options?: { isAdmin?: boolean; password?: string },
): Promise<Pick<User, 'id' | 'email' | 'isAdmin'>> => {
  const normalizedEmail = normalizeEmail(email);
  const username = buildUsername(normalizedEmail);
  const passwordHash = await bcrypt.hash(options?.password ?? 'password123', 10);
  const isAdmin = Boolean(options?.isAdmin);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { passwordHash, isAdmin, username, displayName: username },
    create: { email: normalizedEmail, passwordHash, isAdmin, username, displayName: username },
    select: { id: true, email: true, isAdmin: true },
  });

  return user;
};
