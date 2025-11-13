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
  if (typeof (reply as FastifyReply & { elapsedTime?: number }).elapsedTime === 'number') {
    return (reply as FastifyReply & { elapsedTime: number }).elapsedTime;
  }

  if (typeof reply.getResponseTime === 'function') {
    return reply.getResponseTime();
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
