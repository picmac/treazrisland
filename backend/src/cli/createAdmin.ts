import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnvFiles } from 'dotenv-flow';
import { z } from 'zod';

import { Prompt } from './prompt';

loadEnvFiles({ silent: true });

const prisma = new PrismaClient();
const emailSchema = z.string().email('Please provide a valid email address.');
const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters long.')
  .max(32, 'Username must be 32 characters or fewer.')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only include letters, numbers, and underscores.');
const passwordSchema = z.string().min(12, 'Password must be at least 12 characters long.');

type PromptedValueOptions = {
  envKey?: string;
  hidden?: boolean;
  required?: boolean;
  defaultValue?: string;
  schema?: z.ZodString;
};

const prompt = new Prompt();

const readValue = async (label: string, options: PromptedValueOptions = {}): Promise<string> => {
  const { envKey, hidden, required = false, defaultValue, schema } = options;
  const envValue = envKey ? process.env[envKey]?.trim() : undefined;

  if (envValue) {
    if (hidden) {
      console.log(`${label}: (using value from ${envKey})`);
    } else {
      console.log(`${label}: ${envValue} (from ${envKey})`);
    }

    if (schema) {
      const parsed = schema.safeParse(envValue);
      if (!parsed.success) {
        throw new Error(`${envKey} is invalid: ${parsed.error.errors[0]?.message ?? parsed.error.message}`);
      }

      return parsed.data;
    }

    return envValue;
  }

  while (true) {
    const suffix = defaultValue && !hidden ? ` [default: ${defaultValue}]` : '';
    const answer = await prompt.ask(`${label}${suffix}: `, { hidden });
    const value = answer.trim() || defaultValue || '';

    if (!value && required) {
      console.error(`${label} is required.`);
      continue;
    }

    if (schema) {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        console.error(`${label} is invalid: ${parsed.error.errors[0]?.message ?? parsed.error.message}`);
        continue;
      }

      return parsed.data;
    }

    return value;
  }
};

const getEmail = () => readValue('Admin email', { envKey: 'ADMIN_EMAIL', required: true, schema: emailSchema }).then((value) => value.toLowerCase());

const getUsername = (defaultValue: string) =>
  readValue('Admin username', {
    envKey: 'ADMIN_USERNAME',
    required: true,
    defaultValue,
    schema: usernameSchema,
  }).then((value) => value.toLowerCase());

const getDisplayName = (defaultValue: string) =>
  readValue('Display name (optional)', { envKey: 'ADMIN_DISPLAY_NAME', defaultValue }).then((value) => value || defaultValue);

const getPassword = async (): Promise<string> => {
  const envPassword = process.env.ADMIN_PASSWORD?.trim();

  if (envPassword) {
    const parsed = passwordSchema.safeParse(envPassword);
    if (!parsed.success) {
      throw new Error(`ADMIN_PASSWORD is invalid: ${parsed.error.errors[0]?.message ?? parsed.error.message}`);
    }

    console.log('Using password provided via ADMIN_PASSWORD environment variable.');
    return parsed.data;
  }

  while (true) {
    const password = await readValue('Password', { hidden: true, required: true, schema: passwordSchema });
    const confirmation = await prompt.ask('Confirm password: ', { hidden: true });

    if (password !== confirmation) {
      console.error('Passwords do not match. Please try again.');
      continue;
    }

    return password;
  }
};

const main = async () => {
  try {
    const email = await getEmail();
    const username = await getUsername(email.split('@')[0]);
    const displayName = await getDisplayName(username);
    const password = await getPassword();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new Error('A user with the provided email or username already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
      },
    });

    console.log('\n✅ Admin user created successfully.');
    console.log(`ID: ${admin.id}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Username: ${admin.username}`);
  } catch (error) {
    console.error('\nFailed to create admin user.');
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
