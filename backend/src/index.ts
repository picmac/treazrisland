import { env } from "./config/env.js";
import { buildServer } from "./server.js";

const start = async () => {
  const app = buildServer();

  try {
    await app.listen({ port: env.PORT, host: env.LISTEN_HOST });
    const hostForLog = env.LISTEN_HOST.includes(":")
      ? `[${env.LISTEN_HOST}]`
      : env.LISTEN_HOST;
    const protocol = env.TLS_ENABLED ? "https" : "http";
    app.log.info(
      `Server listening on ${protocol}://${hostForLog}:${env.PORT}`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();
