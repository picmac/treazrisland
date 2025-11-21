import { execSync } from 'node:child_process';
import path from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';

export type TestDatabase = {
  container: StartedTestContainer;
  prisma: PrismaClient;
  pool: Pool;
  connectionString: string;
};

const backendRoot = path.resolve(__dirname, '..', '..');

const runMigrations = (connectionString: string): void => {
  execSync('pnpm prisma migrate deploy', {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: 'ignore',
  });
};

export const startTestDatabase = async (): Promise<TestDatabase> => {
  const container = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'postgres',
      POSTGRES_PASSWORD: 'postgres',
      POSTGRES_DB: 'treazrisland',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const connectionString = `postgresql://postgres:postgres@${host}:${port}/treazrisland`;
  runMigrations(connectionString);
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  return { container, prisma, pool, connectionString };
};

export const stopTestDatabase = async (database?: TestDatabase | null): Promise<void> => {
  if (!database) {
    return;
  }

  await database.prisma.$disconnect();
  await database.pool.end();
  await database.container.stop();
};

export const resetDatabase = async (prisma?: PrismaClient | null): Promise<void> => {
  if (!prisma) {
    return;
  }

  await prisma.$transaction([
    prisma.favorite.deleteMany(),
    prisma.saveState.deleteMany(),
    prisma.session.deleteMany(),
    prisma.invite.deleteMany(),
    prisma.romAsset.deleteMany(),
    prisma.rom.deleteMany(),
    prisma.platform.deleteMany(),
    prisma.user.deleteMany(),
  ]);
};
