import Fastify from 'fastify';

import { getEnv } from './config/env';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.PORT = process.env.PORT ?? '3000';

const env = getEnv();

export const app = Fastify({
  logger: env.NODE_ENV !== 'test',
});

app.get('/health', async () => ({ status: 'ok' }));

export const start = async (): Promise<void> => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

if (require.main === module) {
  void start();
}
