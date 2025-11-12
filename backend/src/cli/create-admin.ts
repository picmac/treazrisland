import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

import { z } from 'zod';

import { getEnv } from '../config/env';
import { invitationService } from '../services/invitations';
import { renderInviteTemplate } from '../services/mailer/templates/invite';

const emailSchema = z.string().email();

const ask = async (query: string, rl: ReturnType<typeof createInterface>): Promise<string> => {
  const answer = await rl.question(query);
  return answer.trim();
};

const main = async (): Promise<void> => {
  const rl = createInterface({ input, output });

  try {
    console.log('Treazrisland admin bootstrap');
    console.log('--------------------------------');
    const emailAnswer = await ask('Admin email: ', rl);
    const emailResult = emailSchema.safeParse(emailAnswer);

    if (!emailResult.success) {
      throw new Error('A valid email address is required to send an invitation.');
    }

    const expiresAnswer = await ask('Invite validity in hours (default 48): ', rl);
    const expiresInHours = expiresAnswer ? Number.parseInt(expiresAnswer, 10) : 48;

    if (Number.isNaN(expiresInHours) || expiresInHours <= 0) {
      throw new Error('Invite expiry must be a positive number of hours.');
    }

    const { invite, token } = await invitationService.createInvitation({
      email: emailResult.data,
      expiresInHours,
    });

    const env = getEnv();
    const inviteUrl = new URL(
      `/accept-invite?token=${token}`,
      `http://localhost:${env.PORT ?? 3000}`,
    ).toString();

    const emailPreview = renderInviteTemplate({
      inviteeEmail: invite.email,
      inviteLink: inviteUrl,
      expiresAt: invite.expiresAt,
      inviterName: 'Treazrisland Operator',
    });

    console.log('\nInvitation created successfully.');
    console.log(`Share this link with your new admin: ${inviteUrl}`);
    console.log('\nEmail subject:');
    console.log(`  ${emailPreview.subject}`);
    console.log('\nPlain text preview:\n');
    console.log(emailPreview.text);
  } finally {
    rl.close();
  }
};

main().catch((error) => {
  console.error('\nFailed to generate admin invitation.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
