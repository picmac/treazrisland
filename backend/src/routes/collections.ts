import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const slugParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "slug is required")
    .transform((value) => value.toLowerCase())
});

const collectionInclude = {
  items: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      position: true,
      note: true,
      romId: true,
      rom: {
        select: {
          id: true,
          title: true,
          platform: {
            select: {
              id: true,
              name: true,
              slug: true,
              shortName: true
            }
          }
        }
      }
    }
  }
} satisfies Prisma.RomCollectionInclude;

function serializeCollection(collection: Prisma.RomCollectionGetPayload<{ include: typeof collectionInclude }>) {
  return {
    id: collection.id,
    slug: collection.slug,
    title: collection.title,
    description: collection.description,
    isPublished: collection.isPublished,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
    createdById: collection.createdById,
    roms: collection.items.map((item) => ({
      id: item.romId,
      title: item.rom?.title ?? "Unknown ROM",
      position: item.position,
      note: item.note,
      platform: item.rom?.platform
        ? {
            id: item.rom.platform.id,
            name: item.rom.platform.name,
            slug: item.rom.platform.slug,
            shortName: item.rom.platform.shortName
          }
        : null
    }))
  };
}

export async function registerCollectionRoutes(app: FastifyInstance) {
  app.get(
    "/collections",
    {
      preHandler: [app.authenticate]
    },
    async () => {
      const collections = await app.prisma.romCollection.findMany({
        where: { isPublished: true },
        orderBy: { updatedAt: "desc" },
        include: collectionInclude
      });

      return {
        collections: collections.map(serializeCollection)
      };
    }
  );

  app.get(
    "/collections/:slug",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const parseResult = slugParamsSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({ message: "Invalid collection slug" });
      }

      const collection = await app.prisma.romCollection.findFirst({
        where: { slug: parseResult.data.slug, isPublished: true },
        include: collectionInclude
      });

      if (!collection) {
        return reply.status(404).send({ message: "Collection not found" });
      }

      return { collection: serializeCollection(collection) };
    }
  );
}
