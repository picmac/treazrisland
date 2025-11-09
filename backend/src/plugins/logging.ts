import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";
import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyRequest,
} from "fastify";

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

type RequestLogger = FastifyBaseLogger & { context?: Record<string, unknown> };

function mergeContext(
  logger: RequestLogger,
  context: Record<string, unknown>,
): void {
  logger.context = {
    ...(logger.context ?? {}),
    ...context,
  };
}

function resolveUserContext(request: FastifyRequest): Record<string, unknown> {
  const user = request.user;
  if (!user) {
    return {};
  }

  const context: Record<string, unknown> = {};
  if (user.sub) {
    context.userId = user.sub;
  }
  if (user.role) {
    context.userRole = user.role.toLowerCase();
  }

  return context;
}

export default fp(async (app: FastifyInstance) => {
  app.decorateRequest(
    "appendLogContext",
    function appendLogContext(
      this: FastifyRequest,
      context: Record<string, unknown>,
    ) {
      const requestLogger = this.requestLogger as RequestLogger | undefined;
      if (!requestLogger) {
        return;
      }

      mergeContext(requestLogger, context);
    },
  );

  app.addHook("onRequest", (request, reply, done) => {
    const correlationId = resolveCorrelationId(
      request.id,
      request.headers["x-request-id"],
    );
    request.correlationId = correlationId;
    reply.header("x-request-id", correlationId);

    const userAgent = request.headers["user-agent"];
    const forwardedFor = request.headers["x-forwarded-for"];
    const baseContext: Record<string, unknown> = {
      requestId: correlationId,
      method: request.method,
      route: request.raw.url,
      remoteAddress: request.ip,
    };

    if (typeof userAgent === "string" && userAgent.trim().length > 0) {
      baseContext.userAgent = userAgent;
    }

    if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
      baseContext.forwardedFor = forwardedFor;
    }

    const baseLogger = request.log.child(baseContext) as RequestLogger;

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
    mergeContext(logger, resolveUserContext(request));

    const endPayload = {
      ...(logger.context ?? {}),
      event: "request.completed",
      method: request.method,
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
    mergeContext(logger, resolveUserContext(request));
    logger.error(
      {
        ...(logger.context ?? {}),
        event: "request.error",
        err: error,
      },
      "request errored",
    );
    done();
  });

  app.addHook("onTimeout", (request, reply, done) => {
    const logger = (request.requestLogger ?? request.log) as RequestLogger;
    mergeContext(logger, resolveUserContext(request));
    logger.warn(
      {
        ...(logger.context ?? {}),
        event: "request.timeout",
        route: request.routeOptions?.url ?? request.raw.url,
        durationMs: durationMs(
          request.metricsStartTime ?? request.requestStartTime,
        ),
      },
      "request timed out",
    );
    reply.log = logger;
    done();
  });
});
