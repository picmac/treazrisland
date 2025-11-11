"use client";

import Image from "next/image";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { PixelButton, PixelNotice } from "@/src/components/pixel";
import { PixelFrame } from "@/src/components/pixel-frame";
import { MfaSettingsPanel } from "@/src/auth/mfa-settings";
import { requestPasswordReset } from "@/src/lib/api/auth";
import { ApiError, API_BASE } from "@/src/lib/api/client";
import type { UserProfile } from "@/src/lib/api/user";
import { deleteCurrentUser, updateUserProfile } from "@/src/lib/api/user";

interface SettingsPageClientProps {
  initialProfile: UserProfile;
}

type FormState = {
  nickname: string;
  displayName: string;
};

type StatusMessage = {
  type: "success" | "error";
  message: string;
};

type NotificationPreferences = {
  emailAlerts: boolean;
  productUpdates: boolean;
};

const NOTIFICATION_STORAGE_KEY = "treaz.settings.notifications";

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailAlerts: true,
  productUpdates: false,
};

const NOTIFICATION_OPTIONS: Array<{
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}> = [
  {
    key: "emailAlerts",
    label: "Email sign-in alerts",
    description: "Receive a heads-up when a new device logs into your account.",
  },
  {
    key: "productUpdates",
    label: "Island update briefings",
    description: "Occasional emails when new quests, ROM features, or patches launch.",
  },
];

export function SettingsPageClient({ initialProfile }: SettingsPageClientProps) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [form, setForm] = useState<FormState>({
    nickname: initialProfile.nickname,
    displayName: initialProfile.displayName ?? "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [isPending, startTransition] = useTransition();
  const [passwordStatus, setPasswordStatus] = useState<StatusMessage | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<StatusMessage | null>(null);
  const [dangerStatus, setDangerStatus] = useState<StatusMessage | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const nicknameFieldId = useId();
  const nicknameHelpId = `${nicknameFieldId}-help`;
  const displayNameFieldId = useId();
  const displayNameHelpId = `${displayNameFieldId}-help`;

  useEffect(() => {
    startTransition(() => {
      setProfile((previous) => {
        if (
          previous.id === initialProfile.id &&
          previous.nickname === initialProfile.nickname &&
          previous.displayName === initialProfile.displayName &&
          previous.avatar?.url === initialProfile.avatar?.url
        ) {
          return previous;
        }
        return initialProfile;
      });
      setForm((previous) => {
        const nextFormState = {
          nickname: initialProfile.nickname,
          displayName: initialProfile.displayName ?? "",
        };
        if (
          previous.nickname === nextFormState.nickname &&
          previous.displayName === nextFormState.displayName
        ) {
          return previous;
        }
        return nextFormState;
      });
    });
  }, [
    initialProfile,
    startTransition,
  ]);

  const previewUrl = useMemo(() => {
    if (!avatarFile) {
      return null;
    }
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  useEffect(() => {
    if (!previewUrl) {
      return;
    }
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<NotificationPreferences> | null;
      if (!parsed || typeof parsed !== "object") {
        return;
      }

      setNotificationPreferences((previous) => ({
        emailAlerts:
          typeof parsed.emailAlerts === "boolean"
            ? parsed.emailAlerts
            : previous.emailAlerts,
        productUpdates:
          typeof parsed.productUpdates === "boolean"
            ? parsed.productUpdates
            : previous.productUpdates,
      }));
    } catch (error) {
      setNotificationStatus({
        type: "error",
        message: "Unable to load saved notification preferences on this device.",
      });
    }
  }, []);

  const currentAvatarUrl = useMemo(() => {
    if (previewUrl) {
      return previewUrl;
    }
    if (!profile.avatar) {
      return null;
    }
    const url = profile.avatar.url;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `${API_BASE}${url}`;
  }, [previewUrl, profile.avatar]);

  const handleInputChange = (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setStatus(null);
      setForm((previous) => ({ ...previous, [field]: event.target.value }));
    };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    setStatus(null);
    const file = event.target.files?.[0] ?? null;
    setAvatarFile(file);
    if (file) {
      setRemoveAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    if (!profile.avatar && !avatarFile) {
      return;
    }
    setAvatarFile(null);
    setRemoveAvatar(true);
    setStatus(null);
  };

  const resetAvatarSelection = () => {
    setAvatarFile(null);
    setRemoveAvatar(false);
    setStatus(null);
  };

  const persistNotificationPreferences = (next: NotificationPreferences) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        NOTIFICATION_STORAGE_KEY,
        JSON.stringify(next),
      );
      setNotificationStatus({
        type: "success",
        message: "Notification preferences saved locally.",
      });
    } catch (error) {
      setNotificationStatus({
        type: "error",
        message: "Unable to store notification preferences on this device.",
      });
    }
  };

  const handleNotificationToggle = (key: keyof NotificationPreferences) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.checked;
      setNotificationStatus(null);
      setNotificationPreferences((previous) => {
        const next = { ...previous, [key]: nextValue };
        persistNotificationPreferences(next);
        return next;
      });
    };

  const handlePasswordResetRequest = () => {
    setPasswordStatus(null);
    startPasswordTransition(async () => {
      try {
        const response = await requestPasswordReset(profile.email);
        setPasswordStatus({
          type: "success",
          message:
            response.message ||
            `If ${profile.email} exists, a reset link is sailing your way.`,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          setPasswordStatus({
            type: "error",
            message: `${error.status}: ${error.message}`,
          });
        } else if (error instanceof Error) {
          setPasswordStatus({ type: "error", message: error.message });
        } else {
          setPasswordStatus({
            type: "error",
            message: "Unable to request a password reset right now.",
          });
        }
      }
    });
  };

  const isDeleteConfirmed = useMemo(
    () => deleteConfirmation.trim().toUpperCase() === "DELETE",
    [deleteConfirmation],
  );

  const handleDeleteConfirmationChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setDangerStatus(null);
    setDeleteConfirmation(event.target.value);
  };

  const handleDeleteAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isDeleteConfirmed) {
      setDangerStatus({
        type: "error",
        message: 'Type "DELETE" to confirm account removal.',
      });
      return;
    }

    setDangerStatus(null);
    startDeleteTransition(async () => {
      try {
        const response = await deleteCurrentUser();
        setDangerStatus({
          type: "success",
          message:
            response.message ||
            "Account deleted. Close this tab or log out to finish the voyage.",
        });
        setDeleteConfirmation("");
      } catch (error) {
        if (error instanceof ApiError) {
          setDangerStatus({
            type: "error",
            message: `${error.status}: ${error.message}`,
          });
        } else if (error instanceof Error) {
          setDangerStatus({ type: "error", message: error.message });
        } else {
          setDangerStatus({
            type: "error",
            message: "Unable to delete the account right now.",
          });
        }
      }
    });
  };

  const trimmedNickname = form.nickname.trim();
  const trimmedDisplayName = form.displayName.trim();
  const originalDisplayName = profile.displayName ?? "";

  const hasNicknameChange = trimmedNickname !== profile.nickname;
  const hasDisplayNameChange = trimmedDisplayName !== originalDisplayName;
  const hasAvatarSelection = Boolean(avatarFile);
  const willRemoveAvatar = removeAvatar;
  const hasChanges =
    hasNicknameChange || hasDisplayNameChange || hasAvatarSelection || willRemoveAvatar;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (!hasChanges) {
      setStatus({ type: "error", message: "No changes to save." });
      return;
    }

    if (hasDisplayNameChange && trimmedDisplayName.length === 0) {
      setStatus({
        type: "error",
        message: "Display name cannot be empty.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          nickname: hasNicknameChange ? trimmedNickname : undefined,
          displayName: hasDisplayNameChange ? trimmedDisplayName : undefined,
          avatarFile: avatarFile ?? undefined,
          removeAvatar: willRemoveAvatar ? true : undefined,
        };

        const result = await updateUserProfile(payload);
        setProfile(result.user);
        setForm({
          nickname: result.user.nickname,
          displayName: result.user.displayName ?? "",
        });
        setAvatarFile(null);
        setRemoveAvatar(false);
        setStatus({
          type: "success",
          message: "Profile updated successfully.",
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (
            typeof error.body === "object" &&
            error.body &&
            "errors" in error.body &&
            error.body.errors &&
            typeof error.body.errors === "object"
          ) {
            const errors = error.body.errors as Record<string, string[]>;
            const firstError = Object.values(errors)[0]?.[0];
            setStatus({
              type: "error",
              message:
                firstError ?? `${error.status}: ${error.message}`,
            });
          } else {
            setStatus({
              type: "error",
              message: `${error.status}: ${error.message}`,
            });
          }
        } else if (error instanceof Error) {
          setStatus({ type: "error", message: error.message });
        } else {
          setStatus({
            type: "error",
            message: "Unexpected error updating profile.",
          });
        }
      }
    });
  };

  const hasProfileAvatar = Boolean(profile.avatar);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <PixelFrame className="flex flex-col gap-6 bg-night/80 p-6" tone="raised">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label
                className="text-xs uppercase tracking-widest text-parchment/70"
                htmlFor={nicknameFieldId}
              >
                Nickname
              </label>
              <input
                id={nicknameFieldId}
                aria-describedby={nicknameHelpId}
                value={form.nickname}
                onChange={handleInputChange("nickname")}
                className="rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-parchment focus:border-lagoon focus:outline-none"
                minLength={3}
                maxLength={32}
                required
              />
              <p id={nicknameHelpId} className="text-xs text-parchment/50">
                Used for login and public leaderboards.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-xs uppercase tracking-widest text-parchment/70"
                htmlFor={displayNameFieldId}
              >
                Display name
              </label>
              <input
                id={displayNameFieldId}
                aria-describedby={displayNameHelpId}
                value={form.displayName}
                onChange={handleInputChange("displayName")}
                className="rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-parchment focus:border-lagoon focus:outline-none"
                maxLength={64}
                placeholder="Captain Threepwood"
              />
              <p id={displayNameHelpId} className="text-xs text-parchment/50">
                Optional label shown to friends. Leave blank to reuse nickname.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[auto,1fr]">
            <div className="flex flex-col items-center gap-3">
              {currentAvatarUrl ? (
                <Image
                  src={currentAvatarUrl}
                  alt="Current avatar"
                  width={128}
                  height={128}
                  unoptimized
                  className="h-32 w-32 rounded-full border-2 border-lagoon object-cover shadow-pixel"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-lagoon/40 text-xs uppercase tracking-widest text-parchment/40">
                  No avatar
                </div>
              )}
              <div className="flex flex-col gap-2 text-center text-xs text-parchment/60">
                <span>PNG, JPEG, or WEBP up to 5&nbsp;MB.</span>
                <div className="flex flex-wrap justify-center gap-2">
                  <label className="cursor-pointer rounded-pixel bg-lagoon px-3 py-1 text-night shadow-pixel transition hover:bg-kelp">
                    Choose file
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={resetAvatarSelection}
                    disabled={!avatarFile && !removeAvatar}
                    className="rounded-pixel border border-ink/40 px-3 py-1 text-xs uppercase tracking-widest text-parchment/70 transition hover:border-lagoon disabled:opacity-40"
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={!hasProfileAvatar && !avatarFile}
                    className="rounded-pixel border border-red-500/40 px-3 py-1 text-xs uppercase tracking-widest text-red-200 transition hover:border-red-400 disabled:opacity-40"
                  >
                    Remove avatar
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-pixel border border-ink/40 bg-night/40 p-4 text-sm text-parchment/80">
              <p>
                Personalise your captain&apos;s log! Upload a pixel-friendly avatar or keep things mysterious with the standard silhouette.
                Removing the avatar deletes it from storage instantly.
              </p>
              {removeAvatar && (
                <p className="text-xs uppercase tracking-widest text-red-300">
                  The current avatar will be removed when you save.
                </p>
              )}
              {avatarFile && (
                <p className="text-xs uppercase tracking-widest text-lagoon">
                  New avatar selected: {avatarFile.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <PixelButton
              type="submit"
              disabled={isPending}
              variant="primary"
              size="md"
              className="self-start"
            >
              {isPending ? "Charting course…" : "Save changes"}
            </PixelButton>
            {status && (
              <PixelNotice tone={status.type}>
                {status.message}
              </PixelNotice>
            )}
          </div>
        </form>
      </PixelFrame>

      <div className="flex flex-col gap-6">
        <MfaSettingsPanel
          initialEnabled={profile.mfaEnabled}
          accountEmail={profile.email}
        />

        <PixelFrame className="flex flex-col gap-4 bg-night/80 p-6" tone="raised">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-lagoon">Password reset</h2>
            <p className="text-sm text-parchment/80">
              Email yourself a fresh password reset link. This uses your account email ({profile.email}).
            </p>
          </header>
          {passwordStatus && (
            <PixelNotice tone={passwordStatus.type}>
              {passwordStatus.message}
            </PixelNotice>
          )}
          <PixelButton
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePasswordResetRequest}
            disabled={isPasswordPending}
          >
            {isPasswordPending ? "Sending reset link…" : "Send reset link"}
          </PixelButton>
        </PixelFrame>

        <PixelFrame className="flex flex-col gap-3 bg-night/80 p-6" tone="raised">
          <h2 className="text-xl font-semibold text-parchment">API tokens</h2>
          <p className="text-sm text-parchment/80">
            Personal access tokens will let you script library syncs or automate uploads without sharing your password. The backend route will arrive with its own token-signing configuration toggle.
          </p>
          <PixelNotice tone="warning">
            Token minting isn&apos;t wired up yet. Keep an eye on release notes or set the signing key early to enable the manager when it arrives.
          </PixelNotice>
        </PixelFrame>

        <PixelFrame className="flex flex-col gap-4 bg-night/80 p-6" tone="raised">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-parchment">Notifications</h2>
            <p className="text-sm text-parchment/80">
              These preferences save to this device until the dedicated API lands.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-parchment/80">
            {NOTIFICATION_OPTIONS.map((option) => (
              <label key={option.key} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-lagoon"
                  checked={notificationPreferences[option.key]}
                  onChange={handleNotificationToggle(option.key)}
                />
                <span className="flex flex-col gap-1">
                  <span className="font-semibold text-parchment">{option.label}</span>
                  <span className="text-xs text-parchment/70">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
          {notificationStatus && (
            <PixelNotice tone={notificationStatus.type}>
              {notificationStatus.message}
            </PixelNotice>
          )}
        </PixelFrame>

        <PixelFrame className="flex flex-col gap-4 bg-night/80 p-6" tone="raised">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-red-200">Danger zone</h2>
            <p className="text-sm text-red-200/80">
              Deleting your account removes your profile, MFA secrets, and refresh tokens immediately. This action cannot be undone.
            </p>
          </header>
          <form onSubmit={handleDeleteAccount} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-parchment/70">
              Type DELETE to confirm
              <input
                value={deleteConfirmation}
                onChange={handleDeleteConfirmationChange}
                className="rounded-pixel border border-red-500/40 bg-night/70 px-3 py-2 text-sm text-parchment focus:border-red-400 focus:outline-none"
                placeholder="DELETE"
                aria-label="Type DELETE to confirm account deletion"
              />
            </label>
            <PixelButton
              type="submit"
              variant="danger"
              size="sm"
              disabled={isDeleting}
            >
              {isDeleting ? "Scuttling account…" : "Delete account"}
            </PixelButton>
          </form>
          {dangerStatus && (
            <PixelNotice tone={dangerStatus.type}>
              {dangerStatus.message}
            </PixelNotice>
          )}
        </PixelFrame>
      </div>
    </div>
  );
}

export default SettingsPageClient;
