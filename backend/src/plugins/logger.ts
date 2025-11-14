import fp from 'fastify-plugin';
import pino, { type LoggerOptions } from 'pino';

import type { Env } from '../config/env';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

export const buildLogger = (env: Env) => {
  const options: LoggerOptions = {
    level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    base: {
      service: 'treazrisland-backend',
      env: env.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (env.LOG_LEVEL) {
    options.level = env.LOG_LEVEL;
  } else if (env.NODE_ENV === 'development') {
    options.level = 'debug';
  }

  return pino(options);
};

const routeFromRequest = (request: FastifyRequest): string => {
  return request.routeOptions?.url ?? request.url;
};

const responseTimeForReply = (reply: FastifyReply): number | undefined => {
  const replyWithElapsedTime = reply as FastifyReply & { elapsedTime?: number };
  if (typeof replyWithElapsedTime.elapsedTime === 'number') {
    return replyWithElapsedTime.elapsedTime;
  }

  const legacyReply = reply as FastifyReply & { getResponseTime?: () => number };
  if (typeof legacyReply.getResponseTime === 'function') {
    return legacyReply.getResponseTime();
  }

  return undefined;
};

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', (request, _reply, done) => {
    const requestLogger = fastify.log.child({
      requestId: request.id,
      route: routeFromRequest(request),
    });

    request.log = requestLogger;
    requestLogger.info({ method: request.method, url: request.url }, 'request received');
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: responseTimeForReply(reply),
      },
      'request completed',
    );
    done();
  });
};

export const loggerPlugin = fp(plugin, {
  name: 'logger-plugin',
});
