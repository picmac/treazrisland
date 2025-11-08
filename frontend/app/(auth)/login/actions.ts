"use server";

import { ApiError } from "@/src/lib/api/client";
import { loginWithCookies, type LoginResponse } from "@/src/lib/api/auth";
import {
  applyBackendCookies,
  buildCookieHeaderFromStore
} from "@/src/lib/server/backend-cookies";

export type LoginActionInput = {
  identifier: string;
  password: string;
  mfaCode?: string;
  recoveryCode?: string;
};

export type LoginActionResult =
  | { success: true; payload: LoginResponse }
  | { success: false; error: string; mfaRequired?: boolean };

export async function performLogin(payload: LoginActionInput): Promise<LoginActionResult> {
  try {
    const cookieHeader = buildCookieHeaderFromStore();
    const { payload: session, cookies } = await loginWithCookies(payload, {
      cookieHeader
    });
    applyBackendCookies(cookies);
    return { success: true, payload: session };
  } catch (error) {
    if (error instanceof ApiError) {
      const body = error.body as { message?: unknown; mfaRequired?: unknown } | undefined;
      const message =
        typeof body?.message === "string" && body.message.length > 0
          ? body.message
          : error.message;
      const mfaRequired = Boolean(body?.mfaRequired);
      return {
        success: false,
        error: message,
        mfaRequired
      };
    }

    if (error instanceof Error) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "Unable to complete login. Try again." };
  }
}
