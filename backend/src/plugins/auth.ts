import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Role } from "@prisma/client";

export default fp(async (app) => {
  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        await request.jwtVerify();
      } catch {
        throw app.httpErrors.unauthorized("Authentication is required");
      }
    }
  );

  app.decorate(
    "requireRole",
    (role: Role) =>
      async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        await app.authenticate(request, reply);
        const userRole = request.user?.role;
        if (userRole !== role) {
          throw app.httpErrors.forbidden("Insufficient permissions");
        }
      }
  );

  app.decorate(
    "requireAdmin",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      await app.requireRole(Role.ADMIN)(request, reply);
    }
  );
});
