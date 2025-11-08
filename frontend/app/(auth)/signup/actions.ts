"use server";

import { ApiError } from "@/src/lib/api/client";
import { redeemInvitation, type SignupResponse } from "@/src/lib/api/auth";
import {
  applyBackendCookies,
  buildCookieHeaderFromStore
} from "@/src/lib/server/backend-cookies";

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
  try {
    const cookieHeader = await buildCookieHeaderFromStore();
    const { payload: session, cookies } = await redeemInvitation(payload, {
      cookieHeader
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
