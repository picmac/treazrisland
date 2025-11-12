"use server";

import { ApiError } from "@/src/lib/api/client";
import { confirmPasswordResetWithCookies, type SessionPayload } from "@/src/lib/api/auth";
import {
  applyBackendCookies,
  buildCookieHeaderFromStore,
} from "@/src/lib/server/backend-cookies";
import { passwordResetConfirmSchema } from "@/lib/validation/auth";
import { headers } from "next/headers";

export type PasswordResetConfirmInput = {
  token: string;
  password: string;
};

export type PasswordResetConfirmResult =
  | { success: true; payload: SessionPayload }
  | { success: false; error: string };

export async function confirmPasswordResetAction(
  payload: PasswordResetConfirmInput,
): Promise<PasswordResetConfirmResult> {
  const sanitized = {
    token: payload.token.trim(),
    password: payload.password,
  };

  const validation = passwordResetConfirmSchema.safeParse(sanitized);
  if (!validation.success) {
    const [firstError] = validation.error.issues;
    return {
      success: false,
      error: firstError?.message ?? "Provide your reset token and a valid password.",
    };
  }

  try {
    const headerStore = headers();
    const cookieHeader = await buildCookieHeaderFromStore();
    const { payload: session, cookies } = await confirmPasswordResetWithCookies(validation.data, {
      cookieHeader,
      requestHeaders: headerStore,
    });
    await applyBackendCookies(cookies);
    return { success: true, payload: session };
  } catch (error) {
    if (error instanceof ApiError) {
      const body = error.body as { message?: unknown } | undefined;
      const message =
        typeof body?.message === "string" && body.message.length > 0
          ? body.message
          : `${error.status}: ${error.message}`;
      return { success: false, error: message };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return {
      success: false,
      error: "We could not reset your password. Try again or request a new link.",
    };
  }
}
