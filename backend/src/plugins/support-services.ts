import fp from "fastify-plugin";
import { createEmailService, type EmailService } from "../services/email/service.js";
import { createMfaService, type MfaService } from "../services/mfa/service.js";

declare module "fastify" {
  interface FastifyInstance {
    emailService: EmailService;
    mfaService: MfaService;
  }
}

export default fp(async (app) => {
  app.decorate("emailService", createEmailService(app.log));
  app.decorate("mfaService", createMfaService());
});
