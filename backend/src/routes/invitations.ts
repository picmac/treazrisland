import { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { Role } from "../utils/prisma-enums.js";

const createInvitationSchema = z.object({
  email: z.string().email().optional(),
  role: z.nativeEnum(Role).default(Role.USER),
  expiresInHours: z
    .number()
    .int()
    .positive()
    .max(720)
    .optional()
});

export async function registerInvitationRoutes(app: FastifyInstance) {
  app.get(
    "/users/invitations",
    {
      preHandler: [app.authenticate, app.requireRole(Role.ADMIN)]
    },
    async () => {
      const invitations = await app.prisma.userInvitation.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 50
      });

      return {
        invitations: invitations.map((invitation) => ({
          id: invitation.id,
          role: invitation.role,
          email: invitation.email,
          expiresAt: invitation.expiresAt.toISOString(),
          redeemedAt: invitation.redeemedAt ? invitation.redeemedAt.toISOString() : null,
          createdAt: invitation.createdAt.toISOString()
        }))
      };
    }
  );

  app.post(
    "/users/invitations",
    {
      preHandler: [app.authenticate, app.requireRole(Role.ADMIN)]
    },
    async (request, reply) => {
      const parseResult = createInvitationSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          message: "Invalid payload",
          errors: parseResult.error.flatten().fieldErrors
        });
      }

      const payload = parseResult.data;
      const expiryHours = payload.expiresInHours ?? env.USER_INVITE_EXPIRY_HOURS;

      if (expiryHours > 720) {
        return reply.status(400).send({
          message: "Invitation expiry exceeds allowed maximum"
        });
      }

      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      if (expiresAt <= new Date()) {
        return reply.status(400).send({
          message: "Invitation expiry must be in the future"
        });
      }

      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");

      const invitation = await app.prisma.userInvitation.create({
        data: {
          tokenHash,
          role: payload.role,
          email: payload.email?.toLowerCase() ?? null,
          expiresAt,
          createdById: request.user.sub
        }
      });

      request.log.info({ invitationId: invitation.id, adminId: request.user.sub }, "Admin issued new invitation");

      return reply.status(201).send({
        invitation: {
          id: invitation.id,
          role: invitation.role,
          email: invitation.email,
          expiresAt: invitation.expiresAt.toISOString(),
          redeemedAt: invitation.redeemedAt
            ? invitation.redeemedAt.toISOString()
            : null,
          createdAt: invitation.createdAt.toISOString()
        },
        token
      });
    }
  );
}
