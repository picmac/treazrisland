import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { appendQueryString, forwardPlayerRequest } from "./proxy.js";

export async function registerPlayRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/play/roms/:id/download",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const targetUrl = appendQueryString(
        `/player/roms/${encodeURIComponent(params.id)}/binary`,
        request,
      );
      return forwardPlayerRequest(app, request, reply, {
        method: "GET",
        url: targetUrl,
      });
    },
  );
}

export default registerPlayRoutes;

