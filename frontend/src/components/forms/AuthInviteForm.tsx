'use client';

import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { redeemInviteToken, type InviteRedemptionResponse } from '@/lib/apiClient';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';

const inviteSchema = z
  .object({
    email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
    displayName: z
      .string()
      .trim()
      .max(80, 'Display name must be 80 characters or fewer.')
      .optional()
      .or(z.literal('')),
    password: z.string().min(8, 'Password must be at least 8 characters long.'),
    confirmPassword: z.string().min(8, 'Confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords must match.',
    path: ['confirmPassword'],
  });

export type AuthInviteFormValues = z.infer<typeof inviteSchema>;

type SubmissionFeedback =
  | { state: 'idle' }
  | { state: 'loading'; message: string }
  | { state: 'success'; message: string; detail?: string }
  | { state: 'error'; message: string };

export interface AuthInviteFormProps {
  token?: string;
  onSuccess?: (response: InviteRedemptionResponse) => void;
}

const initialFeedback: SubmissionFeedback = { state: 'idle' };

const resolveInviteToken = (rawToken?: string) => {
  if (typeof rawToken === 'string' && rawToken.trim().length > 0) {
    return rawToken.trim();
  }

  if (typeof window !== 'undefined') {
    const lastSegment = window.location.pathname.split('/').filter(Boolean).pop();
    if (lastSegment) {
      return lastSegment;
    }
  }

  return '';
};

export default function AuthInviteForm({ token, onSuccess }: AuthInviteFormProps) {
  const fieldId = useId();
  const [feedback, setFeedback] = useState<SubmissionFeedback>(initialFeedback);
  const inviteToken = resolveInviteToken(token);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthInviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      displayName: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!inviteToken) {
      setFeedback({ state: 'error', message: 'Invitation token is missing from the URL.' });
      return;
    }

    setFeedback({ state: 'loading', message: 'Redeeming invitation…' });

    try {
      const normalizedDisplayName = values.displayName?.trim();
      const payload = {
        email: values.email.trim(),
        password: values.password,
        displayName: normalizedDisplayName ? normalizedDisplayName : undefined,
      };
      const response = await redeemInviteToken(inviteToken, payload);

      setFeedback({
        state: 'success',
        message: response.message ?? 'Invite redeemed successfully. Redirecting…',
        detail: response.user?.email ? `Signed in as ${response.user.email}` : undefined,
      });

      onSuccess?.(response);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invite redemption failed. Please try again.';
      setFeedback({ state: 'error', message });
    }
  });

  const emailErrorId = `${fieldId}-email-error`;
  const displayNameErrorId = `${fieldId}-display-name-error`;
  const passwordErrorId = `${fieldId}-password-error`;
  const confirmPasswordErrorId = `${fieldId}-confirm-password-error`;

  const statusTone =
    feedback.state === 'success' ? 'success' : feedback.state === 'error' ? 'danger' : 'info';

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormField
        label="Email"
        description="Use the address tied to your invite."
        error={errors.email?.message ?? undefined}
        inputProps={{
          type: 'email',
          autoComplete: 'email',
          placeholder: 'player@treazr.io',
          ...register('email'),
          'aria-describedby': errors.email ? emailErrorId : undefined,
          'aria-label': 'Email',
          disabled: isSubmitting,
          required: true,
        }}
      />

      <FormField
        label="Display name (optional)"
        description="Shown in your library and save states."
        error={errors.displayName?.message ?? undefined}
        inputProps={{
          type: 'text',
          autoComplete: 'name',
          placeholder: 'Deckhand Nova',
          ...register('displayName'),
          'aria-describedby': errors.displayName ? displayNameErrorId : undefined,
          disabled: isSubmitting,
        }}
      />

      <FormField
        label="Password"
        description="At least 8 characters; never stored in localStorage."
        error={errors.password?.message ?? undefined}
        inputProps={{
          type: 'password',
          autoComplete: 'new-password',
          placeholder: 'Create a password',
          ...register('password'),
          'aria-describedby': errors.password ? passwordErrorId : undefined,
          disabled: isSubmitting,
          required: true,
        }}
      />

      <FormField
        label="Confirm password"
        description="Repeat the password to avoid typos."
        error={errors.confirmPassword?.message ?? undefined}
        inputProps={{
          type: 'password',
          autoComplete: 'new-password',
          placeholder: 'Repeat password',
          ...register('confirmPassword'),
          'aria-describedby': errors.confirmPassword ? confirmPasswordErrorId : undefined,
          disabled: isSubmitting,
          required: true,
        }}
      />

      <Button type="submit" loading={isSubmitting}>
        {isSubmitting ? 'Linking…' : 'Redeem invite'}
      </Button>

      {feedback.state !== 'idle' && (
        <div className="auth-status" role="status" aria-live="polite">
          <StatusPill tone={statusTone}>{feedback.message}</StatusPill>
          {'detail' in feedback && feedback.detail ? (
            <StatusPill tone="info">{feedback.detail}</StatusPill>
          ) : null}
        </div>
      )}
    </form>
  );
}
