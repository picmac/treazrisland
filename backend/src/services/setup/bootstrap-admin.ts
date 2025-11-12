import argon2 from "argon2";
import type { FastifyBaseLogger } from "fastify";

import { env } from "../../config/env.js";
import type { ExtendedPrismaClient } from "../../types/prisma-extensions.js";
import { updateSetupStep } from "./state.js";

export interface BootstrapAdminCredentials {
  email: string;
  nickname: string;
  password: string;
}

export type BootstrapAdminResult =
  | { status: "skipped"; reason: "credentials-unavailable" | "users-exist" }
  | { status: "created"; userId: string }
  | { status: "failed"; reason: "error" };

export interface BootstrapAdminOptions {
  prisma: ExtendedPrismaClient;
  log: FastifyBaseLogger;
  credentials?: BootstrapAdminCredentials | null;
}

export const bootstrapInitialAdmin = async ({
  prisma,
  log,
  credentials = env.BOOTSTRAP_ADMIN_CREDENTIALS,
}: BootstrapAdminOptions): Promise<BootstrapAdminResult> => {
  if (!credentials) {
    log.debug(
      "Skipping admin bootstrap: TREAZ_BOOTSTRAP_ADMIN_* variables are not configured",
    );
    return { status: "skipped", reason: "credentials-unavailable" };
  }

  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      log.info(
        { existingUsers },
        "Skipping admin bootstrap: users already exist",
      );
      return { status: "skipped", reason: "users-exist" };
    }

    const passwordHash = await argon2.hash(credentials.password, {
      type: argon2.argon2id,
    });

    const adminUser = await prisma.user.create({
      data: {
        email: credentials.email.toLowerCase(),
        nickname: credentials.nickname,
        displayName: credentials.nickname,
        passwordHash,
        role: "ADMIN",
      },
    });

    await updateSetupStep(prisma, "first-admin", "COMPLETED", {
      userId: adminUser.id,
      source: "bootstrap",
    });

    log.info(
      { userId: adminUser.id },
      "Initial admin account bootstrapped from environment credentials",
    );

    return { status: "created", userId: adminUser.id };
  } catch (error) {
    log.error({ err: error }, "Failed to bootstrap initial admin account");
    return { status: "failed", reason: "error" };
  }
};

