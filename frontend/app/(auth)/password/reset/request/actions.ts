"use server";

import { ApiError } from "@/src/lib/api/client";
import { requestPasswordReset } from "@/src/lib/api/auth";
import { passwordResetRequestSchema } from "@/lib/validation/auth";

export type PasswordResetRequestInput = {
  email: string;
};

export type PasswordResetRequestResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function submitPasswordResetRequest(
  payload: PasswordResetRequestInput
): Promise<PasswordResetRequestResult> {
  const sanitized = { email: payload.email.trim() };
  const validation = passwordResetRequestSchema.safeParse(sanitized);
  if (!validation.success) {
    const [firstError] = validation.error.issues;
    return {
      success: false,
      error: firstError?.message ?? "Enter a valid email address.",
    };
  }

  try {
    const response = await requestPasswordReset(validation.data.email);
    return { success: true, message: response.message };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: `${error.status}: ${error.message}` };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return {
      success: false,
      error: "We could not process this request right now. Please try again later.",
    };
  }
}
