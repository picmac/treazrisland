import type { FastifyInstance } from "fastify";

export async function registerAdminPlatformRoutes(app: FastifyInstance): Promise<void> {
  app.get("/platforms", async () => {
    const platforms = await app.prisma.platform.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        shortName: true
      }
    });

    return {
      platforms: platforms.map((platform) => ({
        id: platform.id,
        name: platform.name,
        slug: platform.slug,
        shortName: platform.shortName
      }))
    };
  });
}
