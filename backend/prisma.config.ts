import { defineConfig, env } from '@prisma/config';
import { config as loadEnvFiles } from 'dotenv-flow';

loadEnvFiles({ silent: true });

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
