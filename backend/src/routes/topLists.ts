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

const topListInclude = {
  entries: {
    orderBy: { rank: "asc" },
    select: {
      id: true,
      rank: true,
      blurb: true,
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
} satisfies Prisma.RomTopListInclude;

function serializeTopList(topList: Prisma.RomTopListGetPayload<{ include: typeof topListInclude }>) {
  return {
    id: topList.id,
    slug: topList.slug,
    title: topList.title,
    description: topList.description,
    publishedAt: topList.publishedAt?.toISOString() ?? null,
    effectiveFrom: topList.effectiveFrom?.toISOString() ?? null,
    effectiveTo: topList.effectiveTo?.toISOString() ?? null,
    createdAt: topList.createdAt.toISOString(),
    updatedAt: topList.updatedAt.toISOString(),
    createdById: topList.createdById,
    entries: topList.entries.map((entry) => ({
      id: entry.id,
      rank: entry.rank,
      blurb: entry.blurb,
      romId: entry.romId,
      title: entry.rom?.title ?? "Unknown ROM",
      platform: entry.rom?.platform
        ? {
            id: entry.rom.platform.id,
            name: entry.rom.platform.name,
            slug: entry.rom.platform.slug,
            shortName: entry.rom.platform.shortName
          }
        : null
    }))
  };
}

export async function registerTopListRoutes(app: FastifyInstance) {
  app.get(
    "/top-lists",
    {
      preHandler: [app.authenticate]
    },
    async () => {
      const topLists = await app.prisma.romTopList.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
        include: topListInclude
      });

      return {
        topLists: topLists.map(serializeTopList)
      };
    }
  );

  app.get(
    "/top-lists/:slug",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const parseResult = slugParamsSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({ message: "Invalid top list slug" });
      }

      const topList = await app.prisma.romTopList.findFirst({
        where: { slug: parseResult.data.slug, publishedAt: { not: null } },
        include: topListInclude
      });

      if (!topList) {
        return reply.status(404).send({ message: "Top list not found" });
      }

      return { topList: serializeTopList(topList) };
    }
  );
}
