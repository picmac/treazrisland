'use client';

import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { redeemInviteToken, type InviteRedemptionResponse } from '@/lib/apiClient';

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
  token: string;
  onSuccess?: (response: InviteRedemptionResponse) => void;
}

const initialFeedback: SubmissionFeedback = { state: 'idle' };

export default function AuthInviteForm({ token, onSuccess }: AuthInviteFormProps) {
  const fieldId = useId();
  const [feedback, setFeedback] = useState<SubmissionFeedback>(initialFeedback);

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
    setFeedback({ state: 'loading', message: 'Redeeming invitation…' });

    try {
      const normalizedDisplayName = values.displayName?.trim();
      const payload = {
        email: values.email.trim(),
        password: values.password,
        displayName: normalizedDisplayName ? normalizedDisplayName : undefined,
      };
      const response = await redeemInviteToken(token, payload);

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

  return (
    <article className="auth-card">
      <h2>Set up your credentials</h2>
      <p>
        Provide the email tied to your invite along with a strong password so we can unlock your
        Treazr Island profile.
      </p>
      <form onSubmit={onSubmit} noValidate>
        <label>
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="player@treazr.io"
            {...register('email')}
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? emailErrorId : undefined}
            disabled={isSubmitting}
            required
          />
          {errors.email && (
            <p id={emailErrorId} className="auth-field-error" role="alert">
              {errors.email.message}
            </p>
          )}
        </label>

        <label>
          <span>Display name (optional)</span>
          <input
            type="text"
            autoComplete="name"
            placeholder="Deckhand Nova"
            {...register('displayName')}
            aria-invalid={errors.displayName ? 'true' : 'false'}
            aria-describedby={errors.displayName ? displayNameErrorId : undefined}
            disabled={isSubmitting}
          />
          {errors.displayName && (
            <p id={displayNameErrorId} className="auth-field-error" role="alert">
              {errors.displayName.message}
            </p>
          )}
        </label>

        <label>
          <span>Password</span>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            {...register('password')}
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? passwordErrorId : undefined}
            disabled={isSubmitting}
            required
          />
          {errors.password && (
            <p id={passwordErrorId} className="auth-field-error" role="alert">
              {errors.password.message}
            </p>
          )}
        </label>

        <label>
          <span>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            {...register('confirmPassword')}
            aria-invalid={errors.confirmPassword ? 'true' : 'false'}
            aria-describedby={errors.confirmPassword ? confirmPasswordErrorId : undefined}
            disabled={isSubmitting}
            required
          />
          {errors.confirmPassword && (
            <p id={confirmPasswordErrorId} className="auth-field-error" role="alert">
              {errors.confirmPassword.message}
            </p>
          )}
        </label>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Linking…' : 'Redeem invite'}
        </button>
      </form>

      {feedback.state !== 'idle' && (
        <div
          className={`auth-status auth-status--${feedback.state}`}
          role="status"
          aria-live="polite"
        >
          <p>{feedback.message}</p>
          {'detail' in feedback && feedback.detail && <p>{feedback.detail}</p>}
        </div>
      )}
    </article>
  );
}
