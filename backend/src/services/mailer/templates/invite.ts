export type InviteTemplateContext = {
  inviteeEmail: string;
  inviteLink: string;
  expiresAt?: Date | null;
  inviterName?: string;
};

export type InviteTemplate = {
  subject: string;
  text: string;
  html: string;
};

const formatExpiry = (expiresAt?: Date | null): string => {
  if (!expiresAt) {
    return 'This link does not expire, but we recommend using it soon.';
  }

  return `This link expires on ${expiresAt.toUTCString()}.`;
};

export const renderInviteTemplate = (context: InviteTemplateContext): InviteTemplate => {
  const inviter = context.inviterName ?? 'Treazrisland Crew';
  const expiryText = formatExpiry(context.expiresAt);

  const text = [
    `Ahoy ${context.inviteeEmail}!`,
    '',
    `${inviter} has reserved a bunk for you on Treazrisland.`,
    `Claim your spot by visiting: ${context.inviteLink}`,
    expiryText,
    '',
    'If you did not expect this email you can safely ignore it.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Treazrisland Invitation</title>
  </head>
  <body style="font-family: 'Segoe UI', sans-serif; background-color: #031225; color: #f4f2e9; padding: 24px;">
    <h1 style="margin-top: 0;">Ahoy, ${context.inviteeEmail}!</h1>
    <p>${inviter} has invited you to set sail on Treazrisland.</p>
    <p style="margin: 16px 0;">
      <a
        href="${context.inviteLink}"
        style="display: inline-block; padding: 12px 16px; background-color: #ffb347; color: #031225; border-radius: 8px; text-decoration: none; font-weight: bold;"
      >Claim your cabin</a>
    </p>
    <p>${expiryText}</p>
    <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.2); margin: 24px 0;" />
    <small style="color: rgba(244, 242, 233, 0.7);">If the button above does not work, paste this link into your browser:<br />
      <span style="word-break: break-all;">${context.inviteLink}</span>
    </small>
  </body>
</html>`;

  return {
    subject: 'Your Treazrisland invitation is ready',
    text,
    html,
  };
};
