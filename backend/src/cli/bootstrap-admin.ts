import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnvFiles } from 'dotenv-flow';
import { z } from 'zod';

import { Prompt } from './prompt';

loadEnvFiles({ silent: true });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set before running the admin bootstrap.');
}

const prisma = new PrismaClient();
const prompt = new Prompt();

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Please provide a valid email address.')
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long.')
  .max(128, 'Password must be 128 characters or fewer.');

type CliArgs = {
  email?: string;
  password?: string;
};

const parseCliArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = args[index + 1];

    if (next && !next.startsWith('--')) {
      parsed[key as keyof CliArgs] = next;
      index += 1;
    }
  }

  return parsed;
};

const cliArgs = parseCliArgs();

const askEmail = async () => {
  if (cliArgs.email) {
    return emailSchema.parse(cliArgs.email);
  }

  const answer = await prompt.ask('Admin email: ');
  return emailSchema.parse(answer);
};

const askPassword = async (): Promise<string> => {
  if (cliArgs.password) {
    return passwordSchema.parse(cliArgs.password);
  }

  while (true) {
    const password = await prompt.ask('Password: ', { hidden: true });
    const confirmation = await prompt.ask('Confirm password: ', { hidden: true });

    if (password !== confirmation) {
      console.error('Passwords do not match. Please try again.');
      continue;
    }

    return passwordSchema.parse(password);
  }
};

const ensureNoAdminExists = async () => {
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    throw new Error('An admin already exists. Aborting bootstrap to avoid duplicates.');
  }
};

const buildUsernameFromEmail = (email: string) => {
  const prefix = email.split('@')[0] ?? '';
  const sanitised = prefix.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
  return sanitised.length > 0 ? sanitised : 'admin';
};

const main = async () => {
  try {
    await ensureNoAdminExists();

    const email = await askEmail();
    const password = await askPassword();

    const username = buildUsernameFromEmail(email);
    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
      data: {
        email,
        username,
        displayName: username,
        passwordHash,
      },
    });

    console.log('\n✅ Admin user bootstrapped.');
    console.log(`ID: ${admin.id}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Username: ${admin.username}`);
  } catch (error) {
    console.error('\nFailed to bootstrap the admin user.');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  } finally {
    prompt.close();
    await prisma.$disconnect();
  }
};

void main();
