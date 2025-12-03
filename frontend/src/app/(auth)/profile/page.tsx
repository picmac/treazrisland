'use client';

import type React from 'react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { getCurrentUserProfile, updateUserProfile, type UserProfileResponse } from '@/lib/users';
import { PixellabNavigation } from '@/components/chrome';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { FormField } from '@/components/ui/FormField';
import { SignOutButton } from '@/components/ui/SignOutButton';

import styles from './page.module.css';

const profileFormSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(100),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type AvatarSelection = {
  objectKey: string | null;
  previewUrl: string | null;
  contentType: string | null;
  size: number | null;
};

const buildAvatarAlt = (displayName?: string | null) =>
  displayName ? `${displayName}'s avatar` : 'Profile avatar placeholder';

const mergeProfile = (
  existing: UserProfileResponse | undefined,
  updated: UserProfileResponse,
): UserProfileResponse => ({
  ...existing,
  ...updated,
  user: { ...existing?.user, ...updated.user },
});

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [avatarSelection, setAvatarSelection] = useState<AvatarSelection | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileFormSchema) });

  const profileQuery = useQuery({
    queryKey: ['me-profile'],
    queryFn: getCurrentUserProfile,
    staleTime: 15_000,
  });
  const {
    uploadAvatar,
    isUploading,
    error: uploadError,
    reset: resetUploadError,
  } = useAvatarUpload();

  useEffect(() => {
    if (profileQuery.data?.user) {
      reset({ displayName: profileQuery.data.user.displayName ?? '' });
    }
  }, [profileQuery.data, reset]);

  const currentAvatar = useMemo(() => {
    if (avatarSelection) {
      return avatarSelection.previewUrl;
    }

    return profileQuery.data?.user.avatarUrl ?? null;
  }, [avatarSelection, profileQuery.data]);

  const mutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (data) => {
      const cached = queryClient.getQueryData<UserProfileResponse>(['me-profile']);
      queryClient.setQueryData(['me-profile'], mergeProfile(cached, data));
      setAvatarSelection(null);
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!profileQuery.data?.user) {
      return;
    }

    setFormError(null);

    try {
      const payload: {
        displayName: string;
        avatarObjectKey?: string | null;
        avatarContentType?: string | null;
        avatarSize?: number | null;
      } = {
        displayName: values.displayName,
      };

      if (avatarSelection) {
        payload.avatarObjectKey = avatarSelection.objectKey;

        if (avatarSelection.objectKey) {
          payload.avatarContentType = avatarSelection.contentType;
          payload.avatarSize = avatarSelection.size;
        }
      }

      await mutation.mutateAsync(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save profile';
      setFormError(message);
    }
  });

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    resetUploadError();

    try {
      const uploaded = await uploadAvatar(file);
      setAvatarSelection({
        objectKey: uploaded.objectKey,
        previewUrl: uploaded.previewUrl,
        contentType: uploaded.contentType,
        size: uploaded.size,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to upload avatar');
    }
  };

  const clearAvatar = () => {
    setAvatarSelection({ objectKey: null, previewUrl: null, contentType: null, size: null });
  };

  const heroTitle = profileQuery.data?.user?.displayName
    ? `Welcome back, ${profileQuery.data.user.displayName}`
    : 'Complete your Pixellab profile';

  return (
    <div className="page-shell">
      <PixellabNavigation
        links={[
          { href: '/library', label: 'Library' },
          { href: '/onboarding', label: 'Onboarding' },
          { href: '/admin/roms/upload', label: 'Upload' },
        ]}
        eyebrow="Player profile"
        description="Manage your Treazr identity, avatar, and session safety."
        actions={<SignOutButton />}
      />
      <main className="page-content" id="main-content">
        <section className={styles.page} aria-live="polite">
          <Card
            title={heroTitle}
            eyebrow="Profile"
            description="Keep your display name and avatar in sync. Signed URLs are generated against the configured storage bucket."
          >
            <div className={styles.statusRow}>
              <StatusPill tone={profileQuery.data?.isProfileComplete ? 'success' : 'warning'}>
                {profileQuery.data?.isProfileComplete ? 'Profile ready' : 'Profile incomplete'}
              </StatusPill>
              {profileQuery.data?.user.profileUpdatedAt && (
                <StatusPill tone="info">
                  Updated {new Date(profileQuery.data.user.profileUpdatedAt).toLocaleString()}
                </StatusPill>
              )}
            </div>
          </Card>

          <section className={styles.grid} aria-busy={profileQuery.isLoading}>
            <Card
              title="Identity"
              eyebrow="Display name"
              description="Shown in your library, save states, and session overlays."
            >
              {profileQuery.isFetching && <StatusPill tone="info">Refreshing profile…</StatusPill>}
              <form className={styles.form} onSubmit={onSubmit}>
                <FormField
                  label="Display name"
                  error={errors.displayName?.message ?? undefined}
                  inputProps={{
                    ...register('displayName'),
                    placeholder: 'Pixel Protagonist',
                  }}
                />
                <div className={styles.actions}>
                  <Button type="submit" loading={isSubmitting || mutation.isPending}>
                    {mutation.isPending ? 'Saving…' : 'Save changes'}
                  </Button>
                  {formError && <StatusPill tone="danger">{formError}</StatusPill>}
                  {mutation.isSuccess && !formError && (
                    <StatusPill tone="success">Profile updated</StatusPill>
                  )}
                </div>
              </form>
            </Card>

            <Card title="Avatar" eyebrow="Upload & preview">
              {uploadError && <StatusPill tone="danger">{uploadError}</StatusPill>}
              <div className={styles.avatarRow}>
                <div className={styles.avatarPreview}>
                  {currentAvatar ? (
                    <Image
                      src={currentAvatar}
                      alt={buildAvatarAlt(profileQuery.data?.user.displayName)}
                      fill
                      sizes="140px"
                    />
                  ) : (
                    <div className={styles.placeholder}>No avatar yet</div>
                  )}
                </div>
                <div className={styles.avatarControls}>
                  <label className={styles.uploadLabel}>
                    <span className={styles.visuallyHidden}>Avatar upload</span>
                    <Button variant="secondary" type="button">
                      {isUploading ? 'Uploading…' : 'Select image'}
                    </Button>
                    <input
                      className={styles.hiddenInput}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={isUploading || mutation.isPending}
                      aria-label="Choose image"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={clearAvatar}
                    disabled={isUploading}
                  >
                    Remove avatar
                  </Button>
                  {avatarSelection?.objectKey && (
                    <p className={styles.meta}>
                      Ready to save: {avatarSelection.objectKey} ({avatarSelection.size ?? 0} bytes)
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </section>
        </section>
      </main>
    </div>
  );
}
