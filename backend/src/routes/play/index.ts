import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { forwardPlayerRequest } from "./proxy.js";

export async function registerPlayRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/play/roms/:id/download",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const targetUrl = `/player/roms/${encodeURIComponent(params.id)}/binary`;
      return forwardPlayerRequest(app, request, reply, {
        method: "GET",
        url: targetUrl,
      });
    },
  );
}

export default registerPlayRoutes;

