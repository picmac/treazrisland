import { z } from "zod";
import { invitationTokenSchema } from "./invitations.js";

export { invitationTokenSchema };

export const passwordSchema = z
  .string()
  .min(8, "Choose a stronger password")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a digit");

export const signupSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
  email: z.string().email().optional(),
  nickname: z.string().min(3, "Nickname must be at least 3 characters").max(32),
  password: passwordSchema,
  displayName: z.string().min(1).max(64).optional(),
});

export const loginSchema = z
  .object({
    identifier: z.string().min(1).max(128),
    password: z.string().min(8),
    mfaCode: z.string().trim().min(6).max(10).optional(),
    recoveryCode: z.string().trim().min(6).max(128).optional(),
  })
  .refine((value) => !(value.mfaCode && value.recoveryCode), {
    message: "Provide either mfaCode or recoveryCode, not both",
    path: ["mfaCode"],
  });

export const passwordResetRequestSchema = z.object({
  email: z.string().email("Enter a valid email to continue."),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

export const mfaConfirmSchema = z.object({
  secretId: z.string().min(1, "Secret id is required"),
  code: z.string().trim().min(6).max(10),
});

export const mfaDisableSchema = z
  .object({
    mfaCode: z.string().trim().min(6).max(10).optional(),
    recoveryCode: z.string().trim().min(6).max(128).optional(),
  })
  .refine((value) => value.mfaCode || value.recoveryCode, {
    message: "Provide either mfaCode or recoveryCode",
    path: ["mfaCode"],
  })
  .refine((value) => !(value.mfaCode && value.recoveryCode), {
    message: "Provide either mfaCode or recoveryCode, not both",
    path: ["mfaCode"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
export type MfaConfirmInput = z.infer<typeof mfaConfirmSchema>;
export type MfaDisableInput = z.infer<typeof mfaDisableSchema>;
