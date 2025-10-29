import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";
import type { ScreenScraperService } from "../services/screenscraper/service.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (role: Role) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    screenScraperService: ScreenScraperService;
  }

  interface FastifyRequest {
    user?: { sub: string; role: Role };
  }
}
