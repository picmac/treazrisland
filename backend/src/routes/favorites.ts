import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const favoriteParamsSchema = z.object({
  romId: z.string().trim().min(1, "romId is required")
});

export async function registerFavoriteRoutes(app: FastifyInstance) {
  app.get(
    "/favorites",
    {
      preHandler: [app.authenticate]
    },
    async (request) => {
      const favorites = await app.prisma.userRomFavorite.findMany({
        where: { userId: request.user.sub },
        orderBy: { createdAt: "desc" }
      });

      return {
        favorites: favorites.map((favorite) => ({
          romId: favorite.romId,
          createdAt: favorite.createdAt.toISOString()
        }))
      };
    }
  );

  app.post(
    "/favorites/:romId",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const parseResult = favoriteParamsSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({ message: "Invalid ROM identifier" });
      }

      const { romId } = parseResult.data;

      try {
        const favorite = await app.prisma.userRomFavorite.create({
          data: {
            userId: request.user.sub,
            romId
          }
        });

        request.log.info({ userId: request.user.sub, romId }, "ROM marked as favorite");

        return reply.status(201).send({
          favorite: {
            romId: favorite.romId,
            createdAt: favorite.createdAt.toISOString()
          }
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002") {
            return reply.status(204).send();
          }
          if (error.code === "P2003") {
            return reply.status(404).send({ message: "ROM not found" });
          }
        }
        throw error;
      }
    }
  );

  app.delete(
    "/favorites/:romId",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const parseResult = favoriteParamsSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({ message: "Invalid ROM identifier" });
      }

      const { romId } = parseResult.data;

      await app.prisma.userRomFavorite.deleteMany({
        where: {
          userId: request.user.sub,
          romId
        }
      });

      request.log.info({ userId: request.user.sub, romId }, "ROM removed from favorites");

      return reply.status(204).send();
    }
  );
}
