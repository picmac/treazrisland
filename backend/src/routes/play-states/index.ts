import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { appendQueryString, forwardPlayerRequest } from "../play/proxy.js";

function resolveContentType(request: { headers: Record<string, unknown> }): string {
  const header = request.headers["content-type"];
  if (Array.isArray(header)) {
    const value = header.find((entry) => typeof entry === "string");
    return value ?? "application/json";
  }
  return typeof header === "string" && header.length > 0
    ? header
    : "application/json";
}

export async function registerPlayStateRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/play-states",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const targetUrl = appendQueryString("/player/play-states", request);
      return forwardPlayerRequest(app, request, reply, {
        method: "GET",
        url: targetUrl,
      });
    },
  );

  app.get(
    "/play-states/recent",
    { preHandler: [app.authenticate] },
    async (request, reply) =>
      forwardPlayerRequest(app, request, reply, {
        method: "GET",
        url: "/player/play-states/recent",
      }),
  );

  app.get(
    "/play-states/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      return forwardPlayerRequest(app, request, reply, {
        method: "GET",
        url: `/player/play-states/${encodeURIComponent(params.id)}`,
      });
    },
  );

  app.get(
    "/play-states/:id/binary",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      return forwardPlayerRequest(app, request, reply, {
        method: "GET",
        url: `/player/play-states/${encodeURIComponent(params.id)}/binary`,
      });
    },
  );

  app.post(
    "/play-states",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const contentType = resolveContentType(request);
      return forwardPlayerRequest(app, request, reply, {
        method: "POST",
        url: "/player/play-states",
        payload: request.body,
        contentType,
      });
    },
  );

  app.patch(
    "/play-states/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const contentType = resolveContentType(request);
      return forwardPlayerRequest(app, request, reply, {
        method: "PATCH",
        url: `/player/play-states/${encodeURIComponent(params.id)}`,
        payload: request.body,
        contentType,
      });
    },
  );

  app.delete(
    "/play-states/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      return forwardPlayerRequest(app, request, reply, {
        method: "DELETE",
        url: `/player/play-states/${encodeURIComponent(params.id)}`,
      });
    },
  );
}

export default registerPlayStateRoutes;

