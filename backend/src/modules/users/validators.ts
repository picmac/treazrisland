import { z } from 'zod';

export const profilePatchSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    avatarObjectKey: z.string().trim().min(1).max(255).nullable().optional(),
    avatarContentType: z.string().trim().min(3).max(120).nullable().optional(),
    avatarSize: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024)
      .nullable()
      .optional(),
  })
  .refine((data) => Boolean(data.displayName) || data.avatarObjectKey !== undefined, {
    message: 'No profile changes supplied',
  })
  .refine(
    (data) => {
      if (data.avatarObjectKey === null) {
        return data.avatarContentType === undefined && data.avatarSize === undefined;
      }

      const hasAvatarMetadata =
        data.avatarContentType !== undefined || data.avatarSize !== undefined;

      if (!hasAvatarMetadata) {
        return true;
      }

      return data.avatarContentType !== undefined && data.avatarSize !== undefined;
    },
    { message: 'Avatar contentType and size must both be provided together when included' },
  );

export const avatarUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(3),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});
