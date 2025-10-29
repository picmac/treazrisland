import { env } from "./config/env.js";
import { buildServer } from "./server.js";

const start = async () => {
  const app = buildServer();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`Server listening on port ${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();
