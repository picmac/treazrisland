import { randomBytes } from 'node:crypto';

import { config as loadEnvFiles } from 'dotenv-flow';
import { z } from 'zod';

import { Prompt } from './prompt';
import { prisma } from '../config/prisma';

loadEnvFiles({ silent: true });

const prompt = new Prompt();
const emailSchema = z.string().email('Please provide a valid email address.');

const generateInviteCode = (length = 20): string => {
  let code = '';
  while (code.length < length) {
    code += randomBytes(4).toString('hex');
  }
  return code.slice(0, length).toUpperCase();
};

const readOptionalEmail = async (
  label: string,
  envKey?: string,
  options: { allowEmpty?: boolean } = {},
): Promise<string | null> => {
  if (envKey) {
    const envValue = process.env[envKey]?.trim();
    if (envValue) {
      const parsed = emailSchema.safeParse(envValue.toLowerCase());
      if (!parsed.success) {
        throw new Error(
          `${envKey} is invalid: ${parsed.error.errors[0]?.message ?? parsed.error.message}`,
        );
      }

      console.log(`${label}: ${parsed.data} (from ${envKey})`);
      return parsed.data;
    }
  }

  let parsedEmail: string | null = null;

  while (parsedEmail === null) {
    const answer = await prompt.ask(
      `${label}${options.allowEmpty ? ' (leave blank to skip)' : ''}: `,
    );
    const value = answer.trim();
    if (!value && options.allowEmpty) {
      return null;
    }

    if (!value) {
      console.error(`${label} is required.`);
      continue;
    }

    const parsed = emailSchema.safeParse(value.toLowerCase());
    if (!parsed.success) {
      console.error(
        `${label} is invalid: ${parsed.error.errors[0]?.message ?? parsed.error.message}`,
      );
      continue;
    }

    parsedEmail = parsed.data;
  }

  return parsedEmail;
};

const getCreatorId = async (): Promise<string | null> => {
  const envCreator = process.env.INVITE_CREATOR_EMAIL?.trim();
  if (envCreator) {
    const parsed = emailSchema.safeParse(envCreator.toLowerCase());
    if (!parsed.success) {
      throw new Error(
        `INVITE_CREATOR_EMAIL is invalid: ${parsed.error.errors[0]?.message ?? parsed.error.message}`,
      );
    }

    console.log(`Creator email: ${parsed.data} (from INVITE_CREATOR_EMAIL)`);
    const creator = await prisma.user.findUnique({ where: { email: parsed.data } });
    if (!creator) {
      throw new Error(`No user found for creator email: ${parsed.data}`);
    }
    return creator.id;
  }

  let creatorId: string | null = null;

  while (creatorId === null) {
    const creatorEmail = await readOptionalEmail('Creator email (optional)', undefined, {
      allowEmpty: true,
    });

    if (!creatorEmail) {
      return null;
    }

    const creator = await prisma.user.findUnique({ where: { email: creatorEmail } });
    if (creator) {
      creatorId = creator.id;
    } else {
      console.error(`No user found for creator email: ${creatorEmail}`);
    }
  }

  return creatorId;
};

const getExpirationInDays = async (): Promise<number> => {
  const envValue = process.env.INVITE_EXPIRES_IN_DAYS?.trim();
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new Error('INVITE_EXPIRES_IN_DAYS must be a non-negative integer.');
    }
    console.log(`Invite expiry: ${parsed} day(s) (from INVITE_EXPIRES_IN_DAYS)`);
    return parsed;
  }

  let parsedDays: number | null = null;

  while (parsedDays === null) {
    const answer = await prompt.ask('Expires in days (default 7, 0 for no expiry): ');
    if (!answer.trim()) {
      return 7;
    }

    const parsed = Number.parseInt(answer.trim(), 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      parsedDays = parsed;
    } else {
      console.error('Please enter a non-negative number.');
    }
  }

  return parsedDays;
};

const main = async () => {
  try {
    const inviteeEmail = await readOptionalEmail('Invitee email (optional)', 'INVITE_EMAIL', {
      allowEmpty: true,
    });
    const creatorId = await getCreatorId();
    const expiresInDays = await getExpirationInDays();

    const invite = await prisma.invite.create({
      data: {
        code: generateInviteCode(),
        email: inviteeEmail,
        createdById: creatorId ?? undefined,
        expiresAt:
          expiresInDays === 0 ? null : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      },
    });

    console.log('\n✅ Invite created successfully.');
    console.log(`Code: ${invite.code}`);
    if (invite.email) {
      console.log(`Reserved for: ${invite.email}`);
    }
    console.log(`Expires at: ${invite.expiresAt ? invite.expiresAt.toISOString() : 'No expiry'}`);
    if (creatorId) {
      console.log(`Created by user ID: ${creatorId}`);
    }
  } catch (error) {
    console.error('\nFailed to generate invite.');
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
