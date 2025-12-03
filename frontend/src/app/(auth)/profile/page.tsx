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
import { clearStoredAccessToken } from '@/lib/authTokens';
import { logout } from '@/lib/apiClient';

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
  const [signOutStatus, setSignOutStatus] = useState<string | null>(null);

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

  const handleSignOut = async () => {
    setSignOutStatus('Signing out…');
    try {
      await logout();
      clearStoredAccessToken();
      await queryClient.invalidateQueries({ queryKey: ['me-profile'] });
      setSignOutStatus('Signed out. Return to login to start a new session.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign out. Please try again.';
      setSignOutStatus(message);
    }
  };

  const heroTitle = profileQuery.data?.user?.displayName
    ? `Welcome back, ${profileQuery.data.user.displayName}`
    : 'Complete your Pixellab profile';

  return (
    <div className="pixellab-grid">
      <div className="pixellab-content">
        <main className={styles.wrapper} id="main-content">
          <section className={styles.headerCard} aria-live="polite">
            <p className="eyebrow">Profile</p>
            <h1>{heroTitle}</h1>
            <p className="lede">
              Keep your display name and avatar up to date so your saves and high scores feel like
              home. Signed URLs are generated against the configured storage bucket.
            </p>
            <div className={styles.pillRow}>
              <span className={styles.pill} aria-label="Profile completeness">
                {profileQuery.data?.isProfileComplete ? 'Profile ready' : 'Profile incomplete'}
              </span>
              {profileQuery.data?.user.profileUpdatedAt && (
                <span className={styles.pill}>
                  Updated {new Date(profileQuery.data.user.profileUpdatedAt).toLocaleString()}
                </span>
              )}
              <button type="button" className={styles.ghostButton} onClick={handleSignOut}>
                Sign out
              </button>
            </div>
            {signOutStatus && (
              <p role="status" className={styles.meta}>
                {signOutStatus}
              </p>
            )}
          </section>

          <section className={styles.grid} aria-busy={profileQuery.isLoading}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className="eyebrow">Identity</p>
                  <h2>Display name</h2>
                </div>
                {profileQuery.isFetching && <span className={styles.badge}>Refreshing</span>}
              </div>

              <form className={styles.form} onSubmit={onSubmit}>
                <label className={styles.field}>
                  <span>Display name</span>
                  <input
                    {...register('displayName')}
                    placeholder="Pixel Protagonist"
                    aria-invalid={Boolean(errors.displayName)}
                  />
                  {errors.displayName && (
                    <span className={styles.error}>{errors.displayName.message}</span>
                  )}
                </label>

                <div className={styles.actions}>
                  <button type="submit" disabled={isSubmitting || mutation.isPending}>
                    {mutation.isPending ? 'Saving...' : 'Save changes'}
                  </button>
                  {formError && <span className={styles.error}>{formError}</span>}
                  {mutation.isSuccess && !formError && (
                    <span className={styles.success}>Profile updated</span>
                  )}
                </div>
              </form>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className="eyebrow">Avatar</p>
                  <h2>Upload & preview</h2>
                </div>
                {uploadError && <span className={styles.error}>{uploadError}</span>}
              </div>

              <div className={styles.avatarRow}>
                <div className={styles.avatarPreview}>
                  {currentAvatar ? (
                    <Image
                      src={currentAvatar}
                      alt={buildAvatarAlt(profileQuery.data?.user.displayName)}
                      fill
                      sizes="96px"
                    />
                  ) : (
                    <div className={styles.placeholder}>No avatar yet</div>
                  )}
                </div>
                <div className={styles.avatarControls}>
                  <label className={styles.uploadButton}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={isUploading || mutation.isPending}
                    />
                    <span>{isUploading ? 'Uploading…' : 'Choose image'}</span>
                  </label>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={clearAvatar}
                    disabled={isUploading}
                  >
                    Remove avatar
                  </button>
                  {avatarSelection?.objectKey && (
                    <p className={styles.meta}>
                      Ready to save: {avatarSelection.objectKey} ({avatarSelection.size ?? 0} bytes)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
