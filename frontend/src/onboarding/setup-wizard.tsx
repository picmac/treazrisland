'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { ApiError, apiFetch } from "@lib/api/client";
import { PixelFrame } from "@/src/components/pixel-frame";
import { useSession } from "@/src/auth/session-provider";
import type {
  OnboardingStatus,
  OnboardingStepKey,
  OnboardingStepState,
} from "./types";

const STEP_ORDER: OnboardingStepKey[] = [
  "system-profile",
  "integrations",
  "personalization",
];

type StorageDriver = "filesystem" | "s3";

type SettingsUpdatePayload = {
  systemProfile?: {
    instanceName: string;
    timezone: string;
    baseUrl?: string;
  };
  storage?: {
    driver: StorageDriver;
    localRoot?: string;
    bucketAssets: string;
    bucketRoms: string;
    bucketBios?: string;
    signedUrlTTLSeconds?: number;
    s3?: {
      endpoint: string;
      region: string;
      accessKey: string;
      secretKey: string;
      forcePathStyle?: boolean;
    };
  };
  email?: {
    provider: "none" | "postmark";
    postmark?: {
      serverToken: string;
      fromEmail: string;
      messageStream?: string;
    };
  };
  screenscraper?: {
    username?: string;
    password?: string;
    secretKey?: string;
  };
  personalization?: {
    theme?: string;
  };
};

type WizardStepResult = {
  setupComplete: boolean;
  steps: Record<OnboardingStepKey, OnboardingStepState>;
};

interface ResolvedSystemSettings {
  systemProfile: {
    instanceName: string;
    timezone: string;
    baseUrl?: string;
  };
  storage: {
    driver: StorageDriver;
    localRoot?: string;
    bucketAssets: string;
    bucketRoms: string;
    bucketBios?: string;
    signedUrlTTLSeconds?: number;
    s3?: {
      endpoint: string;
      region: string;
      accessKey: string;
      secretKey: string;
      forcePathStyle?: boolean;
    };
  };
  email: {
    provider: "none" | "postmark";
    postmark?: {
      serverToken: string;
      fromEmail: string;
      messageStream?: string;
    };
  };
  metrics: {
    enabled: boolean;
    token?: string;
    allowedCidrs: string[];
  };
  screenscraper: {
    username?: string;
    password?: string;
    secretKey?: string;
  };
  personalization: {
    theme?: string;
  };
}

const computePendingSteps = (
  steps: Record<OnboardingStepKey, OnboardingStepState>,
): OnboardingStepKey[] =>
  STEP_ORDER.filter((step) => steps[step]?.status === "PENDING");

interface SetupWizardProps {
  initialStatus: OnboardingStatus;
}

export function SetupWizard({ initialStatus }: SetupWizardProps) {
  const [status, setStatus] = useState(initialStatus);
  const [settings, setSettings] = useState<ResolvedSystemSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { accessToken } = useSession();

  const pendingSteps = useMemo(() => computePendingSteps(status.steps), [status]);
  const currentStep = pendingSteps[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!accessToken) {
      return;
    }

    const loadSettings = async () => {
      setLoadingSettings(true);
      try {
        const response = await apiFetch<ResolvedSystemSettings>("/admin/settings", {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        });
        if (!cancelled) {
          setSettings(response);
        }
      } catch (error) {
        if (!cancelled) {
          setSubmissionError(
            error instanceof ApiError
              ? `${error.status}: ${error.message}`
              : "Unable to load current settings",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingSettings(false);
        }
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const mergeSettings = useCallback((update: SettingsUpdatePayload) => {
    setSettings((previous) => {
      if (!previous) {
        return null;
      }
      const next: ResolvedSystemSettings = {
        ...previous,
        systemProfile: update.systemProfile
          ? { ...previous.systemProfile, ...update.systemProfile }
          : previous.systemProfile,
        storage: update.storage
          ? {
              ...previous.storage,
              ...update.storage,
              s3: update.storage.s3
                ? { ...previous.storage.s3, ...update.storage.s3 }
                : previous.storage.s3,
            }
          : previous.storage,
        email: update.email
          ? {
              ...previous.email,
              ...update.email,
              postmark: update.email.postmark
                ? { ...previous.email.postmark, ...update.email.postmark }
                : previous.email.postmark,
            }
          : previous.email,
        screenscraper: update.screenscraper
          ? { ...previous.screenscraper, ...update.screenscraper }
          : previous.screenscraper,
        personalization: update.personalization
          ? { ...previous.personalization, ...update.personalization }
          : previous.personalization,
        metrics: previous.metrics,
      };
      return next;
    });
  }, []);

  const handleStepUpdate = useCallback(
    async (
      stepKey: OnboardingStepKey,
      payload: { status: "COMPLETED" | "SKIPPED"; settings?: SettingsUpdatePayload },
    ) => {
      setSubmissionError(null);
      setSubmitting(true);
      try {
        const response = await apiFetch<WizardStepResult>(`/onboarding/steps/${stepKey}`,
          {
            method: "PATCH",
            headers: accessToken
              ? { authorization: `Bearer ${accessToken}` }
              : undefined,
            body: JSON.stringify(payload),
          });
        setStatus((previous) => ({
          needsSetup: !response.setupComplete,
          setupComplete: response.setupComplete,
          steps: {
            ...previous.steps,
            ...response.steps,
          },
          pendingSteps: computePendingSteps(response.steps),
        }));
        if (payload.settings) {
          mergeSettings(payload.settings);
        }
      } catch (error) {
        setSubmissionError(
          error instanceof ApiError
            ? `${error.status}: ${error.message}`
            : error instanceof Error
            ? error.message
            : "Failed to update setup step",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [accessToken, mergeSettings],
  );

  const handleComplete = async (
    stepKey: OnboardingStepKey,
    settingsPayload: SettingsUpdatePayload,
  ) => {
    await handleStepUpdate(stepKey, {
      status: "COMPLETED",
      settings: settingsPayload,
    });
  };

  const handleSkip = async (stepKey: OnboardingStepKey) => {
    await handleStepUpdate(stepKey, { status: "SKIPPED" });
  };

  if (status.setupComplete) {
    return (
      <PixelFrame className="space-y-4">
        <h2 className="text-lg uppercase tracking-widest text-primary">
          Setup complete
        </h2>
        <p className="text-sm text-slate-200">
          TREAZRISLAND is ready. You can revisit system settings anytime from the
          admin console.
        </p>
        <Link
          href="/play"
          className="inline-flex w-full items-center justify-center rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-background hover:bg-primary-dark"
        >
          Enter the island
        </Link>
      </PixelFrame>
    );
  }

  if (!currentStep) {
    return (
      <PixelFrame className="space-y-4">
        <h2 className="text-lg uppercase tracking-widest text-primary">
          Preparing next step…
        </h2>
      </PixelFrame>
    );
  }

  if (loadingSettings || !settings) {
    return (
      <PixelFrame className="space-y-4">
        <h2 className="text-lg uppercase tracking-widest text-primary">
          Loading current configuration
        </h2>
        <p className="text-sm text-slate-200">Gathering system defaults…</p>
      </PixelFrame>
    );
  }

  return (
    <PixelFrame className="space-y-6">
      <header className="space-y-2 text-center">
        <h2 className="text-lg uppercase tracking-widest text-primary">
          {renderStepTitle(currentStep)}
        </h2>
        <p className="text-sm text-slate-200">
          {renderStepDescription(currentStep)}
        </p>
      </header>
      {submissionError && (
        <p className="rounded border border-red-400 bg-red-500/20 p-2 text-xs text-red-200">
          {submissionError}
        </p>
      )}
      {currentStep === "system-profile" && (
        <SystemProfileStep
          settings={settings}
          submitting={submitting}
          onSubmit={async (update) => {
            await handleComplete("system-profile", update);
          }}
        />
      )}
      {currentStep === "integrations" && (
        <IntegrationsStep
          settings={settings}
          submitting={submitting}
          onSubmit={async (update) => {
            await handleComplete("integrations", update);
          }}
          onSkip={async () => {
            await handleSkip("integrations");
          }}
        />
      )}
      {currentStep === "personalization" && (
        <PersonalizationStep
          settings={settings}
          submitting={submitting}
          onSubmit={async (update) => {
            await handleComplete("personalization", update);
          }}
          onSkip={async () => {
            await handleSkip("personalization");
          }}
        />
      )}
    </PixelFrame>
  );
}

function renderStepTitle(step: OnboardingStepKey): string {
  switch (step) {
    case "system-profile":
      return "Configure system profile";
    case "integrations":
      return "Connect integrations";
    case "personalization":
      return "Personalize your portal";
    default:
      return "Setup";
  }
}

function renderStepDescription(step: OnboardingStepKey): string {
  switch (step) {
    case "system-profile":
      return "Name your instance, set the timezone, and choose where ROMs live.";
    case "integrations":
      return "Configure optional services like Postmark email and ScreenScraper.";
    case "personalization":
      return "Pick a theme to greet future keepers of the vault.";
    default:
      return "";
  }
}

interface SystemProfileStepProps {
  settings: ResolvedSystemSettings;
  submitting: boolean;
  onSubmit: (update: SettingsUpdatePayload) => Promise<void>;
}

function SystemProfileStep({ settings, submitting, onSubmit }: SystemProfileStepProps) {
  const [instanceName, setInstanceName] = useState(
    settings.systemProfile.instanceName ?? "TREAZRISLAND",
  );
  const [timezone, setTimezone] = useState(settings.systemProfile.timezone ?? "UTC");
  const [baseUrl, setBaseUrl] = useState(settings.systemProfile.baseUrl ?? "");
  const [driver, setDriver] = useState<StorageDriver>(settings.storage.driver);
  const [localRoot, setLocalRoot] = useState(settings.storage.localRoot ?? "/var/treaz/storage");
  const [bucketAssets, setBucketAssets] = useState(settings.storage.bucketAssets ?? "assets");
  const [bucketRoms, setBucketRoms] = useState(settings.storage.bucketRoms ?? "roms");
  const [bucketBios, setBucketBios] = useState(settings.storage.bucketBios ?? "bios");
  const [signedUrlTTL, setSignedUrlTTL] = useState(
    settings.storage.signedUrlTTLSeconds?.toString() ?? "",
  );
  const [endpoint, setEndpoint] = useState(settings.storage.s3?.endpoint ?? "");
  const [region, setRegion] = useState(settings.storage.s3?.region ?? "");
  const [accessKey, setAccessKey] = useState(settings.storage.s3?.accessKey ?? "");
  const [secretKey, setSecretKey] = useState(settings.storage.s3?.secretKey ?? "");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: SettingsUpdatePayload = {
      systemProfile: {
        instanceName: instanceName.trim(),
        timezone: timezone.trim(),
        baseUrl: baseUrl.trim() ? baseUrl.trim() : undefined,
      },
      storage:
        driver === "filesystem"
          ? {
              driver,
              localRoot: localRoot.trim(),
              bucketAssets: bucketAssets.trim(),
              bucketRoms: bucketRoms.trim(),
              bucketBios: bucketBios.trim() || undefined,
              signedUrlTTLSeconds: signedUrlTTL
                ? Number.parseInt(signedUrlTTL, 10)
                : undefined,
            }
          : {
              driver,
              bucketAssets: bucketAssets.trim(),
              bucketRoms: bucketRoms.trim(),
              bucketBios: bucketBios.trim() || undefined,
              signedUrlTTLSeconds: signedUrlTTL
                ? Number.parseInt(signedUrlTTL, 10)
                : undefined,
              s3: {
                endpoint: endpoint.trim(),
                region: region.trim(),
                accessKey: accessKey.trim(),
                secretKey: secretKey.trim(),
                forcePathStyle: true,
              },
            },
    };

    await onSubmit(payload);
  };

  return (
    <form className="space-y-4 text-left" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="instanceName">
          Instance name
        </label>
        <input
          id="instanceName"
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          value={instanceName}
          onChange={(event) => setInstanceName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="timezone">
          Timezone
        </label>
        <input
          id="timezone"
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="baseUrl">
          Base URL (optional)
        </label>
        <input
          id="baseUrl"
          type="url"
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://treaz.example.com"
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-widest text-slate-300">
          Storage driver
        </legend>
        <label className="flex items-center space-x-2 text-sm text-slate-200">
          <input
            type="radio"
            name="storageDriver"
            value="filesystem"
            checked={driver === "filesystem"}
            onChange={() => setDriver("filesystem")}
          />
          <span>Filesystem (default)</span>
        </label>
        <label className="flex items-center space-x-2 text-sm text-slate-200">
          <input
            type="radio"
            name="storageDriver"
            value="s3"
            checked={driver === "s3"}
            onChange={() => setDriver("s3")}
          />
          <span>Compatible S3 API</span>
        </label>
      </fieldset>
      {driver === "filesystem" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-widest text-slate-300">
              Local root
            </span>
            <input
              className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              value={localRoot}
              onChange={(event) => setLocalRoot(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-widest text-slate-300">
              Signed URL TTL (seconds, optional)
            </span>
            <input
              className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              value={signedUrlTTL}
              onChange={(event) => setSignedUrlTTL(event.target.value)}
              placeholder="600"
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-widest text-slate-300">
              Endpoint URL
            </span>
            <input
              className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-widest text-slate-300">
              Region
            </span>
            <input
              className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-widest text-slate-300">
              Access key
            </span>
            <input
              className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-widest text-slate-300">
              Secret key
            </span>
            <input
              type="password"
              className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              value={secretKey}
              onChange={(event) => setSecretKey(event.target.value)}
              required
            />
          </label>
          <label className="space-y-1 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-widest text-slate-300">
              Signed URL TTL (seconds, optional)
            </span>
            <input
              className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              value={signedUrlTTL}
              onChange={(event) => setSignedUrlTTL(event.target.value)}
              placeholder="600"
            />
          </label>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm text-slate-200">
          <span className="block text-xs uppercase tracking-widest text-slate-300">
            Asset bucket
          </span>
          <input
            className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            value={bucketAssets}
            onChange={(event) => setBucketAssets(event.target.value)}
            required
          />
        </label>
        <label className="space-y-1 text-sm text-slate-200">
          <span className="block text-xs uppercase tracking-widest text-slate-300">
            ROM bucket
          </span>
          <input
            className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            value={bucketRoms}
            onChange={(event) => setBucketRoms(event.target.value)}
            required
          />
        </label>
        <label className="space-y-1 text-sm text-slate-200">
          <span className="block text-xs uppercase tracking-widest text-slate-300">
            BIOS bucket (optional)
          </span>
          <input
            className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            value={bucketBios}
            onChange={(event) => setBucketBios(event.target.value)}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-background hover:bg-primary-dark disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}

interface IntegrationsStepProps {
  settings: ResolvedSystemSettings;
  submitting: boolean;
  onSubmit: (update: SettingsUpdatePayload) => Promise<void>;
  onSkip: () => Promise<void>;
}

function IntegrationsStep({ settings, submitting, onSubmit, onSkip }: IntegrationsStepProps) {
  const [postmarkEnabled, setPostmarkEnabled] = useState(
    settings.email.provider === "postmark",
  );
  const [serverToken, setServerToken] = useState(
    settings.email.postmark?.serverToken ?? "",
  );
  const [fromEmail, setFromEmail] = useState(
    settings.email.postmark?.fromEmail ?? "",
  );
  const [messageStream, setMessageStream] = useState(
    settings.email.postmark?.messageStream ?? "",
  );
  const [screenScraperUser, setScreenScraperUser] = useState(
    settings.screenscraper.username ?? "",
  );
  const [screenScraperPassword, setScreenScraperPassword] = useState(
    settings.screenscraper.password ?? "",
  );
  const [screenScraperSecret, setScreenScraperSecret] = useState(
    settings.screenscraper.secretKey ?? "",
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const update: SettingsUpdatePayload = {};
    update.email = postmarkEnabled
      ? {
          provider: "postmark",
          postmark: {
            serverToken: serverToken.trim(),
            fromEmail: fromEmail.trim(),
            messageStream: messageStream.trim() || undefined,
          },
        }
      : { provider: "none" };

    if (
      screenScraperUser.trim() ||
      screenScraperPassword.trim() ||
      screenScraperSecret.trim()
    ) {
      update.screenscraper = {
        username: screenScraperUser.trim() || undefined,
        password: screenScraperPassword.trim() || undefined,
        secretKey: screenScraperSecret.trim() || undefined,
      };
    }

    await onSubmit(update);
  };

  return (
    <form className="space-y-4 text-left" onSubmit={handleSubmit}>
      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-widest text-slate-300">
          Email notifications
        </legend>
        <label className="flex items-center space-x-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={postmarkEnabled}
            onChange={(event) => setPostmarkEnabled(event.target.checked)}
          />
          <span>Enable Postmark for password resets</span>
        </label>
        {postmarkEnabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-200">
              <span className="block text-xs uppercase tracking-widest text-slate-300">
                Server token
              </span>
              <input
                className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                value={serverToken}
                onChange={(event) => setServerToken(event.target.value)}
                required
              />
            </label>
            <label className="space-y-1 text-sm text-slate-200">
              <span className="block text-xs uppercase tracking-widest text-slate-300">
                From email
              </span>
              <input
                type="email"
                className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                value={fromEmail}
                onChange={(event) => setFromEmail(event.target.value)}
                required
              />
            </label>
            <label className="space-y-1 text-sm text-slate-200 sm:col-span-2">
              <span className="block text-xs uppercase tracking-widest text-slate-300">
                Message stream (optional)
              </span>
              <input
                className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                value={messageStream}
                onChange={(event) => setMessageStream(event.target.value)}
              />
            </label>
          </div>
        )}
      </fieldset>
      <div className="space-y-2">
        <h3 className="text-xs uppercase tracking-widest text-slate-300">
          ScreenScraper credentials (optional)
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            placeholder="Username"
            value={screenScraperUser}
            onChange={(event) => setScreenScraperUser(event.target.value)}
          />
          <input
            type="password"
            className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            placeholder="Password"
            value={screenScraperPassword}
            onChange={(event) => setScreenScraperPassword(event.target.value)}
          />
          <input
            className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            placeholder="Secret key"
            value={screenScraperSecret}
            onChange={(event) => setScreenScraperSecret(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-background hover:bg-primary-dark disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save integrations"}
        </button>
        <button
          type="button"
          onClick={() => onSkip()}
          disabled={submitting}
          className="w-full rounded border border-slate-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-200 hover:border-slate-300 disabled:opacity-60"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}

interface PersonalizationStepProps {
  settings: ResolvedSystemSettings;
  submitting: boolean;
  onSubmit: (update: SettingsUpdatePayload) => Promise<void>;
  onSkip: () => Promise<void>;
}

function PersonalizationStep({
  settings,
  submitting,
  onSubmit,
  onSkip,
}: PersonalizationStepProps) {
  const [theme, setTheme] = useState(settings.personalization.theme ?? "monkey-island");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ personalization: { theme: theme.trim() || undefined } });
  };

  return (
    <form className="space-y-4 text-left" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="block text-xs uppercase tracking-widest text-slate-300" htmlFor="theme">
          Portal theme
        </label>
        <select
          id="theme"
          className="w-full rounded border border-primary/40 bg-background px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
        >
          <option value="monkey-island">Monkey Island (default)</option>
          <option value="midnight-harbor">Midnight Harbor</option>
          <option value="sunset-reef">Sunset Reef</option>
        </select>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-background hover:bg-primary-dark disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Finish setup"}
        </button>
        <button
          type="button"
          onClick={() => onSkip()}
          disabled={submitting}
          className="w-full rounded border border-slate-500 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-200 hover:border-slate-300 disabled:opacity-60"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
