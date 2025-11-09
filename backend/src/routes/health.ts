import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { HealthManager, HealthReport } from "../plugins/health.js";

function sendHealth(
  request: FastifyRequest,
  reply: FastifyReply,
  report: HealthReport,
  probe: "live" | "ready",
) {
  if (typeof request.appendLogContext === "function") {
    request.appendLogContext({ probe });
  }

  reply.header("cache-control", "no-store, max-age=0, must-revalidate");
  reply.header("content-type", "application/json; charset=utf-8");

  if (report.status === "fail") {
    reply.code(503);
  }

  reply.log.info(
    {
      event: "health.probe",
      probe,
      status: report.status,
      components: report.components.map((component) => ({
        component: component.component,
        status: component.status,
      })),
    },
    "health probe evaluated",
  );

  return reply.send(report);
}

export function registerHealthRoutes(app: FastifyInstance) {
  const manager = app.health as HealthManager;

  app.get("/health/live", async (request, reply) => {
    const report = await manager.live();
    return sendHealth(request, reply, report, "live");
  });

  const readyHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const report = await manager.ready();
    return sendHealth(request, reply, report, "ready");
  };

  app.get("/health/ready", readyHandler);
  app.get("/health", readyHandler);
}
