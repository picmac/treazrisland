"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { ApiError, API_BASE } from "@/src/lib/api/client";
import type { UserProfile } from "@/src/lib/api/user";
import { updateUserProfile } from "@/src/lib/api/user";
import { MfaSettingsPanel } from "@/src/auth/mfa-settings";

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

export function SettingsPageClient({ initialProfile }: SettingsPageClientProps) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [form, setForm] = useState<FormState>({
    nickname: initialProfile.nickname,
    displayName: initialProfile.displayName ?? "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [isPending, startTransition] = useTransition();

  const nicknameFieldId = useId();
  const nicknameHelpId = `${nicknameFieldId}-help`;
  const displayNameFieldId = useId();
  const displayNameHelpId = `${displayNameFieldId}-help`;

  useEffect(() => {
    setForm({
      nickname: profile.nickname,
      displayName: profile.displayName ?? "",
    });
  }, [profile]);

  useEffect(() => {
    if (!avatarFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [avatarFile]);

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
    <div className="flex flex-col gap-6">
      <section className="pixel-frame flex flex-col gap-6 p-6">
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
              <img
                src={currentAvatarUrl}
                alt="Current avatar"
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
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded-pixel bg-kelp px-6 py-2 text-sm font-semibold uppercase tracking-widest text-night shadow-pixel transition hover:bg-lagoon disabled:opacity-60"
          >
            {isPending ? "Charting course…" : "Save changes"}
          </button>
          {status && (
            <p
              className={`text-sm ${
                status.type === "success" ? "text-lagoon" : "text-red-300"
              }`}
            >
              {status.message}
            </p>
          )}
        </div>
        </form>
      </section>

      <MfaSettingsPanel initialEnabled={profile.mfaEnabled} accountEmail={profile.email} />
    </div>
  );
}

export default SettingsPageClient;
