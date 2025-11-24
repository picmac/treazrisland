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
      if (data.avatarObjectKey === undefined) {
        return !data.avatarContentType && data.avatarSize === undefined;
      }

      if (data.avatarObjectKey === null) {
        return data.avatarContentType === undefined && data.avatarSize === undefined;
      }

      return data.avatarContentType !== undefined && data.avatarSize !== undefined;
    },
    {
      message: 'Avatar metadata must accompany avatarObjectKey changes',
    },
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
