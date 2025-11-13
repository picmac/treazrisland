import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

import { invitationService } from '../../services/invitations';
import { renderInviteTemplate } from '../../services/mailer/templates/invite';

const ensureAdminSession: preHandlerHookHandler = async (request, reply) => {
  try {
    const payload = await request.jwtVerify();

    if (!payload.email) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
    };
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
};

const inviteRequestSchema = z.object({
  email: z.string().email(),
  expiresInHours: z.coerce.number().int().positive().max(24 * 14).optional(),
});

export const adminInvitationsController: FastifyPluginAsync = async (fastify) => {
  fastify.post('/invitations', { preHandler: ensureAdminSession }, async (request, reply) => {
    const parsed = inviteRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid invitation payload' });
    }

    const { email, expiresInHours } = parsed.data;

    const { invite, token } = await invitationService.createInvitation({
      email,
      expiresInHours,
      createdById: request.user?.id,
    });

    const inviteUrl = new URL(
      `/accept-invite?token=${token}`,
      `http://localhost:${fastify.config.PORT ?? 3000}`,
    ).toString();

    const emailPreview = renderInviteTemplate({
      inviteeEmail: email,
      inviteLink: inviteUrl,
      expiresAt: invite.expiresAt,
    });

    return reply.status(201).send({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      token,
      inviteUrl,
      emailPreview,
    });
  });
};
