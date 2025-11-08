import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Logger } from "pino";

function resolveCorrelationId(
  requestId: string,
  incoming?: string | string[],
): string {
  if (typeof incoming === "string" && incoming.trim().length > 0) {
    return incoming.trim();
  }

  if (Array.isArray(incoming) && incoming.length > 0) {
    const candidate = incoming[0];
    if (candidate && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  if (requestId && !requestId.startsWith("req-")) {
    return requestId;
  }

  return randomUUID();
}

function durationMs(start?: bigint): number | undefined {
  if (!start) {
    return undefined;
  }

  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

type RequestLogger = Logger & { context?: Record<string, unknown> };

export default fp(async (app: FastifyInstance) => {
  app.addHook("onRequest", (request, reply, done) => {
    const correlationId = resolveCorrelationId(
      request.id,
      request.headers["x-request-id"],
    );
    request.correlationId = correlationId;
    reply.header("x-request-id", correlationId);

    const baseLogger = request.log.child({
      requestId: correlationId,
      method: request.method,
      route: request.raw.url,
      remoteAddress: request.ip,
    });

    request.requestLogger = baseLogger;
    request.requestStartTime = process.hrtime.bigint();

    baseLogger.info({ event: "request.received" }, "request received");
    done();
  });

  app.addHook("preHandler", (request, reply, done) => {
    const requestLogger = request.requestLogger as RequestLogger | undefined;
    if (requestLogger) {
      reply.log = requestLogger;
    }
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const logger = (request.requestLogger ?? request.log) as RequestLogger;
    const endPayload = {
      event: "request.completed",
      statusCode: reply.statusCode,
      route: request.routeOptions?.url ?? request.raw.url,
      durationMs: durationMs(
        request.metricsStartTime ?? request.requestStartTime,
      ),
      contentLength: reply.getHeader("content-length") ?? undefined,
    };

    logger.info(endPayload, "request completed");
    done();
  });

  app.addHook("onError", (request, _reply, error, done) => {
    const logger = (request.requestLogger ?? request.log) as RequestLogger;
    logger.error({ event: "request.error", err: error }, "request errored");
    done();
  });
});
