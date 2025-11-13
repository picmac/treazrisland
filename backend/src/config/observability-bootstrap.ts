import { getEnv } from './env';
import { startObservability } from './observability';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.PORT = process.env.PORT ?? '3000';

const env = getEnv();

startObservability(env);
