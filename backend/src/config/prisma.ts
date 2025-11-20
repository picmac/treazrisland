import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { getEnv } from './env';

const { DATABASE_URL } = getEnv();
const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

export const createPrismaClient = (): PrismaClient => new PrismaClient({ adapter });
