"use server";

import { headers } from "next/headers";

import { ApiError } from "@/src/lib/api/client";
import { redeemInvitation, type SignupResponse } from "@/src/lib/api/auth";
import {
  applyBackendCookies,
  buildCookieHeaderFromStore
} from "@/src/lib/server/backend-cookies";
import { signupSchema } from "@/lib/validation/auth";

export type SignupActionInput = {
  token: string;
  email?: string;
  nickname: string;
  password: string;
  displayName?: string;
};

export type SignupActionResult =
  | { success: true; payload: SignupResponse }
  | { success: false; error: string };

export async function redeemInvitationAction(
  payload: SignupActionInput
): Promise<SignupActionResult> {
  const headerStore = headers();
  const sanitizedPayload = {
    token: payload.token,
    email: payload.email?.trim() || undefined,
    nickname: payload.nickname.trim(),
    password: payload.password,
    displayName: payload.displayName?.trim() || payload.nickname.trim(),
  };

  const validation = signupSchema.safeParse(sanitizedPayload);
  if (!validation.success) {
    const [firstError] = validation.error.issues;
    return {
      success: false,
      error: firstError?.message ?? "Please review your details and try again.",
    };
  }

  try {
    const cookieHeader = await buildCookieHeaderFromStore();
    const { payload: session, cookies } = await redeemInvitation(validation.data, {
      cookieHeader,
      requestHeaders: headerStore
    });
    await applyBackendCookies(cookies);
    return { success: true, payload: session };
  } catch (error) {
    if (error instanceof ApiError) {
      const body = error.body as { message?: unknown } | undefined;
      const message =
        typeof body?.message === "string" && body.message.length > 0
          ? body.message
          : error.message;
      return { success: false, error: message };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return {
      success: false,
      error: "We could not redeem this invitation. Try again or request a new invite."
    };
  }
}
