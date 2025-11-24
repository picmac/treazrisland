import type { Prisma, PrismaClient } from '@prisma/client';

import type { AvatarStorage } from './avatar.storage';

export const userProfileSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarObjectKey: true,
  avatarContentType: true,
  avatarSize: true,
  avatarUploadedAt: true,
  createdAt: true,
  updatedAt: true,
  profileUpdatedAt: true,
  profileCompletedAt: true,
} satisfies Prisma.UserSelect;

export type UserProfileRecord = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>;

export type ProfileUpdateInput = {
  displayName?: string;
  avatarObjectKey?: string | null;
  avatarContentType?: string | null;
  avatarSize?: number | null;
};

export const isProfileComplete = (user: { displayName: string | null | undefined }): boolean =>
  Boolean(user.displayName && user.displayName.trim().length > 1);

export const serializeUserProfile = async (
  user: UserProfileRecord,
  avatarStorage: AvatarStorage,
) => {
  const avatarUrl = user.avatarObjectKey
    ? await avatarStorage.getSignedAvatarUrl(user.avatarObjectKey)
    : null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarObjectKey: user.avatarObjectKey,
    avatarContentType: user.avatarContentType,
    avatarSize: user.avatarSize,
    avatarUploadedAt: user.avatarUploadedAt?.toISOString() ?? null,
    avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    profileUpdatedAt: user.profileUpdatedAt?.toISOString() ?? null,
    profileCompletedAt: user.profileCompletedAt?.toISOString() ?? null,
  };
};

export const updateUserProfile = async (
  prisma: PrismaClient,
  avatarStorage: AvatarStorage,
  userId: string,
  input: ProfileUpdateInput,
) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: userProfileSelect,
  });

  if (!existingUser) {
    return null;
  }

  const now = new Date();
  const nextDisplayName = input.displayName?.trim() ?? existingUser.displayName;
  const profileComplete = isProfileComplete({ displayName: nextDisplayName });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      profileUpdatedAt: now,
      ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
      ...(input.avatarObjectKey !== undefined
        ? {
            avatarObjectKey: input.avatarObjectKey,
            avatarContentType: input.avatarObjectKey ? input.avatarContentType : null,
            avatarSize: input.avatarObjectKey ? input.avatarSize : null,
            avatarUploadedAt: input.avatarObjectKey ? now : null,
          }
        : {}),
      profileCompletedAt: profileComplete
        ? (existingUser.profileCompletedAt ?? now)
        : existingUser.profileCompletedAt,
    },
    select: userProfileSelect,
  });

  return {
    user: await serializeUserProfile(updatedUser, avatarStorage),
    isProfileComplete: profileComplete,
  };
};
