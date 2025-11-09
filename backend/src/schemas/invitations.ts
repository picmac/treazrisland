import { z } from "zod";
import { Role } from "../utils/prisma-enums.js";

export const invitationTokenSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export const createInvitationSchema = z.object({
  email: z.string().email().optional(),
  role: z.nativeEnum(Role).default(Role.USER),
  expiresInHours: z
    .number()
    .int()
    .positive()
    .max(720)
    .optional(),
});

export type InvitationTokenInput = z.infer<typeof invitationTokenSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
