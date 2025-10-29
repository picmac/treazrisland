import { FastifyInstance } from "fastify";
import { randomBytes, createHash } from "node:crypto";
import { env } from "../config/env.js";
import type { Role } from "@prisma/client";

export async function issueSessionTokens(app: FastifyInstance, userId: string, role: Role) {
  const accessToken = app.jwt.sign({
    sub: userId,
    role
  });

  const refreshToken = randomBytes(48).toString("hex");
  const refreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_MS);

  await app.prisma.refreshToken.create({
    data: {
      tokenHash: createHash("sha256").update(refreshToken).digest("hex"),
      userId,
      expiresAt: refreshExpiresAt
    }
  });

  return {
    accessToken,
    refreshToken,
    refreshExpiresAt
  };
}
