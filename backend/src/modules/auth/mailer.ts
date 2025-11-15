import type { FastifyBaseLogger } from 'fastify';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailTransport = {
  send: (message: MailMessage) => Promise<void>;
};

export type InviteEmailOptions = {
  email: string;
  inviteCode: string;
  redeemUrl?: string;
};

export type MagicLinkEmailOptions = {
  email: string;
  magicLinkUrl?: string;
  token: string;
};

const buildInviteEmail = ({
  inviteCode,
  redeemUrl,
}: InviteEmailOptions): Omit<MailMessage, 'to'> => {
  const subject = "You're invited to Treazr Island";
  const redemptionDetails = redeemUrl
    ? `Redeem your invite here: ${redeemUrl}`
    : `Use invite code ${inviteCode} to create your account.`;

  const text = [
    'Ahoy adventurer!',
    '',
    'Someone shared an invite to Treazr Island with you.',
    redemptionDetails,
    '',
    'This code is single-use. If you did not expect this message you can ignore it.',
  ].join('\n');

  const html = `
    <p>Ahoy adventurer!</p>
    <p>Someone shared an invite to Treazr Island with you.</p>
    <p><strong>${redemptionDetails}</strong></p>
    <p>This code is single-use. If you did not expect this message you can ignore it.</p>
  `;

  return { subject, text, html };
};

const buildMagicLinkEmail = ({
  magicLinkUrl,
  token,
}: MagicLinkEmailOptions): Omit<MailMessage, 'to'> => {
  const subject = 'Your Treazr Island magic link';
  const fallback = `Magic link token: ${token}`;
  const text = magicLinkUrl
    ? `Use the following link to sign in: ${magicLinkUrl}\n\nIf you cannot click the link, copy and paste it into your browser.`
    : `${fallback}\n\nEnter this token in the Treazr Island app to continue.`;

  const html = magicLinkUrl
    ? `
        <p>Use the following link to sign in:</p>
        <p><a href="${magicLinkUrl}">${magicLinkUrl}</a></p>
        <p>If you cannot click the link, copy and paste it into your browser.</p>
      `
    : `
        <p>${fallback}</p>
        <p>Enter this token in the Treazr Island app to continue.</p>
      `;

  return { subject, text, html };
};

class DevMailTransport implements MailTransport {
  constructor(private readonly logger: FastifyBaseLogger) {}

  async send(message: MailMessage): Promise<void> {
    this.logger.info(
      {
        email: {
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        },
      },
      'Stub email transport delivered message',
    );
  }
}

export class AuthMailer {
  constructor(private readonly transport: MailTransport) {}

  async sendInviteEmail(options: InviteEmailOptions): Promise<void> {
    const message = buildInviteEmail(options);
    await this.transport.send({ ...message, to: options.email });
  }

  async sendMagicLinkEmail(options: MagicLinkEmailOptions): Promise<void> {
    const message = buildMagicLinkEmail(options);
    await this.transport.send({ ...message, to: options.email });
  }
}

export const createAuthMailer = (logger: FastifyBaseLogger): AuthMailer => {
  return new AuthMailer(new DevMailTransport(logger));
};
