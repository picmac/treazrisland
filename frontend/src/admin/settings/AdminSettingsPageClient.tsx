"use client";

import { useCallback, useState } from "react";
import { PixelButton, PixelNotice } from "@/src/components/pixel";
import { PixelFrame } from "@/src/components/pixel-frame";
import {
  fetchAdminSettings,
  type EmailSettings,
  type MetricsSettings,
  type PersonalizationSettings,
  type ResolvedSystemSettings,
  type ScreenScraperSettings,
  type SettingsUpdatePayload,
  type StorageDriver,
  type StorageSettings,
  type SystemProfileSettings,
  updateAdminSettings,
} from "@/src/lib/api/admin/settings";
import { ApiError } from "@/src/lib/api/client";
import {
  type EmailSettingsFormValues,
  type MetricsSettingsFormValues,
  type PersonalizationFormValues,
  type ScreenScraperFormValues,
  type StorageSettingsFormValues,
  type SystemProfileSettingsFormValues,
  validateEmailSection,
  validateMetricsSection,
  validatePersonalizationSection,
  validateScreenScraperSection,
  validateStorageSection,
  validateSystemProfileSection,
} from "./validation";

interface AdminSettingsPageClientProps {
  initialSettings: ResolvedSystemSettings;
  initialError?: string | null;
}

type SectionKey =
  | "systemProfile"
  | "storage"
  | "email"
  | "metrics"
  | "screenscraper"
  | "personalization";

type SectionStatus = {
  state: "idle" | "pending" | "success" | "error";
  message?: string;
};

type SectionStatusMap = Record<SectionKey, SectionStatus>;

type SectionErrors = Record<string, string>;

interface SectionState<TValues> {
  values: TValues;
  errors: SectionErrors;
}

const DEFAULT_STATUS: SectionStatus = { state: "idle" };

function withDefaultStatus(map: Partial<SectionStatusMap>): SectionStatusMap {
  return {
    systemProfile: DEFAULT_STATUS,
    storage: DEFAULT_STATUS,
    email: DEFAULT_STATUS,
    metrics: DEFAULT_STATUS,
    screenscraper: DEFAULT_STATUS,
    personalization: DEFAULT_STATUS,
    ...map,
  };
}

const successMessages: Record<SectionKey, string> = {
  systemProfile: "System profile updated.",
  storage: "Storage configuration saved.",
  email: "Email preferences saved.",
  metrics: "Metrics settings saved.",
  screenscraper: "ScreenScraper preferences saved.",
  personalization: "Personalization updated.",
};

function StatusMessage({ status }: { status: SectionStatus }) {
  if (status.state === "idle") {
    return null;
  }

  if (status.state === "pending") {
    return (
      <PixelNotice tone="info">
        <span className="font-semibold uppercase tracking-widest">Saving…</span>
      </PixelNotice>
    );
  }

  if (status.state === "success" && status.message) {
    return (
      <PixelNotice tone="success">
        <span className="font-semibold uppercase tracking-widest">{status.message}</span>
      </PixelNotice>
    );
  }

  if (status.state === "error" && status.message) {
    return (
      <PixelNotice tone="danger">
        <span className="font-semibold uppercase tracking-widest">{status.message}</span>
      </PixelNotice>
    );
  }

  return null;
}

interface SectionCardProps {
  title: string;
  description: string;
  status: SectionStatus;
  onSubmit: () => void;
  submitLabel?: string;
  submitting?: boolean;
  children: React.ReactNode;
}

function SectionCard({
  title,
  description,
  status,
  onSubmit,
  submitLabel = "Save changes",
  submitting = false,
  children,
}: SectionCardProps) {
  return (
    <PixelFrame className="space-y-4 bg-night/85 p-6 shadow-pixel">
      <header className="space-y-1">
        <h2 className="text-lg uppercase tracking-[0.4em] text-primary">{title}</h2>
        <p className="text-xs text-slate-200">{description}</p>
      </header>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-3">{children}</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <StatusMessage status={status} />
          <PixelButton type="submit" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </PixelButton>
        </div>
      </form>
    </PixelFrame>
  );
}

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.body && typeof error.body === "object" && "message" in error.body) {
      const message = (error.body as { message?: unknown }).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }
    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return error.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unable to save changes.";
}

const toInitialSystemProfileState = (
  systemProfile: SystemProfileSettings,
): SystemProfileSettingsFormValues => ({
  instanceName: systemProfile.instanceName ?? "",
  timezone: systemProfile.timezone ?? "",
  baseUrl: systemProfile.baseUrl ?? "",
});

const toInitialStorageState = (
  storage: StorageSettings,
): StorageSettingsFormValues => ({
  driver: storage.driver,
  localRoot: storage.localRoot ?? "",
  bucketAssets: storage.bucketAssets ?? "",
  bucketRoms: storage.bucketRoms ?? "",
  bucketBios: storage.bucketBios ?? "",
  signedUrlTTLSeconds: storage.signedUrlTTLSeconds?.toString() ?? "",
  s3Endpoint: storage.s3?.endpoint ?? "",
  s3Region: storage.s3?.region ?? "",
  s3AccessKey: storage.s3?.accessKey ?? "",
  s3SecretKey: "",
  s3ForcePathStyle: storage.s3?.forcePathStyle ?? true,
});

const toInitialEmailState = (email: EmailSettings): EmailSettingsFormValues => ({
  provider: email.provider,
  host: email.smtp?.host ?? "",
  port: email.smtp?.port ? String(email.smtp.port) : "",
  secure: email.smtp?.secure ?? "starttls",
  fromEmail: email.smtp?.fromEmail ?? "",
  fromName: email.smtp?.fromName ?? "",
  allowInvalidCerts: email.smtp?.allowInvalidCerts ?? false,
  enableAuth: Boolean(email.smtp?.auth?.username),
  authUsername: email.smtp?.auth?.username ?? "",
  authPassword: "",
});

const toInitialMetricsState = (metrics: MetricsSettings): MetricsSettingsFormValues => ({
  enabled: metrics.enabled,
  token: metrics.token ?? "",
  allowedCidrs: metrics.allowedCidrs.join("\n"),
});

const toInitialScreenScraperState = (
  settings: ScreenScraperSettings,
): ScreenScraperFormValues => ({
  username: settings.username ?? "",
  password: "",
  secretKey: "",
  devId: settings.devId ?? "",
  devPassword: "",
  baseUrl: settings.baseUrl ?? "",
  requestsPerMinute: settings.requestsPerMinute?.toString() ?? "",
  concurrency: settings.concurrency?.toString() ?? "",
  timeoutMs: settings.timeoutMs?.toString() ?? "",
  languagePriority: settings.languagePriority?.join("\n") ?? "",
  regionPriority: settings.regionPriority?.join("\n") ?? "",
  mediaTypes: settings.mediaTypes?.join("\n") ?? "",
  onlyBetterMedia: settings.onlyBetterMedia ?? false,
  maxAssetsPerType: settings.maxAssetsPerType?.toString() ?? "",
});

const toInitialPersonalizationState = (
  personalization: PersonalizationSettings,
): PersonalizationFormValues => ({
  theme: personalization.theme ?? "",
});

export function AdminSettingsPageClient({
  initialSettings,
  initialError = null,
}: AdminSettingsPageClientProps) {
  const [settings, setSettings] = useState<ResolvedSystemSettings>(initialSettings);
  const [statuses, setStatuses] = useState<SectionStatusMap>(withDefaultStatus({}));
  const [isSubmitting, setIsSubmitting] = useState<Record<SectionKey, boolean>>({
    systemProfile: false,
    storage: false,
    email: false,
    metrics: false,
    screenscraper: false,
    personalization: false,
  });
  const [loadError, setLoadError] = useState<string | null>(initialError);

  const [systemProfileState, setSystemProfileState] = useState<SectionState<SystemProfileSettingsFormValues>>({
    values: toInitialSystemProfileState(initialSettings.systemProfile),
    errors: {},
  });

  const [storageState, setStorageState] = useState<
    SectionState<StorageSettingsFormValues> & { existingSecret?: string }
  >({
    values: toInitialStorageState(initialSettings.storage),
    errors: {},
    existingSecret: initialSettings.storage.s3?.secretKey,
  });

  const [emailState, setEmailState] = useState<
    SectionState<EmailSettingsFormValues> & { existingPassword?: string }
  >({
    values: toInitialEmailState(initialSettings.email),
    errors: {},
    existingPassword: initialSettings.email.smtp?.auth?.password,
  });

  const [metricsState, setMetricsState] = useState<SectionState<MetricsSettingsFormValues>>({
    values: toInitialMetricsState(initialSettings.metrics),
    errors: {},
  });

  const [screenScraperState, setScreenScraperState] = useState<
    SectionState<ScreenScraperFormValues> & {
      existingPassword?: string;
      existingSecret?: string;
      existingDevPassword?: string;
    }
  >({
    values: toInitialScreenScraperState(initialSettings.screenscraper),
    errors: {},
    existingPassword: initialSettings.screenscraper.password,
    existingSecret: initialSettings.screenscraper.secretKey,
    existingDevPassword: initialSettings.screenscraper.devPassword,
  });

  const [personalizationState, setPersonalizationState] = useState<SectionState<PersonalizationFormValues>>({
    values: toInitialPersonalizationState(initialSettings.personalization),
    errors: {},
  });

  const setSubmitting = useCallback((key: SectionKey, value: boolean) => {
    setIsSubmitting((previous) => ({ ...previous, [key]: value }));
  }, []);

  const applyStatus = useCallback((key: SectionKey, status: SectionStatus) => {
    setStatuses((previous) => ({ ...previous, [key]: status }));
  }, []);

  const resetSectionState = useCallback(
    (key: SectionKey, nextSettings: ResolvedSystemSettings) => {
      switch (key) {
        case "systemProfile":
          setSystemProfileState({
            values: toInitialSystemProfileState(nextSettings.systemProfile),
            errors: {},
          });
          break;
        case "storage":
          setStorageState({
            values: toInitialStorageState(nextSettings.storage),
            errors: {},
            existingSecret: nextSettings.storage.s3?.secretKey,
          });
          break;
        case "email":
          setEmailState({
            values: toInitialEmailState(nextSettings.email),
            errors: {},
            existingPassword: nextSettings.email.smtp?.auth?.password,
          });
          break;
        case "metrics":
          setMetricsState({
            values: toInitialMetricsState(nextSettings.metrics),
            errors: {},
          });
          break;
        case "screenscraper":
          setScreenScraperState({
            values: toInitialScreenScraperState(nextSettings.screenscraper),
            errors: {},
            existingPassword: nextSettings.screenscraper.password,
            existingSecret: nextSettings.screenscraper.secretKey,
            existingDevPassword: nextSettings.screenscraper.devPassword,
          });
          break;
        case "personalization":
          setPersonalizationState({
            values: toInitialPersonalizationState(nextSettings.personalization),
            errors: {},
          });
          break;
        default:
          break;
      }
    },
  []);

  const handleSettingsUpdate = useCallback(
    async (key: SectionKey, payload: SettingsUpdatePayload) => {
      setSubmitting(key, true);
      applyStatus(key, { state: "pending" });
      const previous = settings;

      try {
        setSettings((current) => ({ ...current, ...payload } as ResolvedSystemSettings));
        const response = await updateAdminSettings(payload);
        setSettings(response);
        resetSectionState(key, response);
        applyStatus(key, { state: "success", message: successMessages[key] });
      } catch (error) {
        setSettings(previous);
        applyStatus(key, { state: "error", message: formatApiError(error) });
      } finally {
        setSubmitting(key, false);
      }
    },
    [applyStatus, resetSectionState, setSubmitting, settings],
  );

  const refreshFromServer = useCallback(async () => {
    try {
      const refreshed = await fetchAdminSettings();
      setSettings(refreshed);
      resetSectionState("systemProfile", refreshed);
      resetSectionState("storage", refreshed);
      resetSectionState("email", refreshed);
      resetSectionState("metrics", refreshed);
      resetSectionState("screenscraper", refreshed);
      resetSectionState("personalization", refreshed);
      setStatuses(withDefaultStatus({}));
      setLoadError(null);
    } catch (error) {
      setLoadError(formatApiError(error));
    }
  }, [resetSectionState]);

  const submitSystemProfile = useCallback(async () => {
    const result = validateSystemProfileSection(systemProfileState.values, settings.systemProfile);
    setSystemProfileState((previous) => ({ ...previous, errors: result.errors }));
    if (Object.keys(result.errors).length > 0) {
      applyStatus("systemProfile", { state: "error", message: "Check highlighted fields." });
      return;
    }
    if (!result.changed || !result.data) {
      applyStatus("systemProfile", { state: "success", message: "No changes detected." });
      return;
    }
    await handleSettingsUpdate("systemProfile", { systemProfile: result.data });
  }, [
    applyStatus,
    handleSettingsUpdate,
    settings.systemProfile,
    systemProfileState.values,
  ]);

  const submitStorage = useCallback(async () => {
    const result = validateStorageSection(
      storageState.values,
      settings.storage,
      storageState.existingSecret,
    );
    setStorageState((previous) => ({ ...previous, errors: result.errors }));
    if (Object.keys(result.errors).length > 0) {
      applyStatus("storage", { state: "error", message: "Fix validation errors." });
      return;
    }
    if (!result.changed || !result.data) {
      applyStatus("storage", { state: "success", message: "No changes detected." });
      return;
    }
    await handleSettingsUpdate("storage", { storage: result.data });
  }, [
    applyStatus,
    handleSettingsUpdate,
    settings.storage,
    storageState.existingSecret,
    storageState.values,
  ]);

  const submitEmail = useCallback(async () => {
    const result = validateEmailSection(emailState.values, settings.email, emailState.existingPassword);
    setEmailState((previous) => ({ ...previous, errors: result.errors }));
    if (Object.keys(result.errors).length > 0) {
      applyStatus("email", { state: "error", message: "Fix validation errors." });
      return;
    }
    if (!result.changed || !result.data) {
      applyStatus("email", { state: "success", message: "No changes detected." });
      return;
    }
    await handleSettingsUpdate("email", { email: result.data });
  }, [applyStatus, emailState.existingPassword, emailState.values, handleSettingsUpdate, settings.email]);

  const submitMetrics = useCallback(async () => {
    const result = validateMetricsSection(metricsState.values, settings.metrics);
    setMetricsState((previous) => ({ ...previous, errors: result.errors }));
    if (Object.keys(result.errors).length > 0) {
      applyStatus("metrics", { state: "error", message: "Fix validation errors." });
      return;
    }
    if (!result.changed || !result.data) {
      applyStatus("metrics", { state: "success", message: "No changes detected." });
      return;
    }
    await handleSettingsUpdate("metrics", { metrics: result.data });
  }, [applyStatus, handleSettingsUpdate, metricsState.values, settings.metrics]);

  const submitScreenScraper = useCallback(async () => {
    const result = validateScreenScraperSection(
      screenScraperState.values,
      settings.screenscraper,
      {
        existingPassword: screenScraperState.existingPassword,
        existingSecret: screenScraperState.existingSecret,
        existingDevPassword: screenScraperState.existingDevPassword,
      },
    );
    setScreenScraperState((previous) => ({ ...previous, errors: result.errors }));
    if (Object.keys(result.errors).length > 0) {
      applyStatus("screenscraper", { state: "error", message: "Fix validation errors." });
      return;
    }
    if (!result.changed || !result.data) {
      applyStatus("screenscraper", { state: "success", message: "No changes detected." });
      return;
    }
    await handleSettingsUpdate("screenscraper", { screenscraper: result.data });
  }, [
    applyStatus,
    handleSettingsUpdate,
    screenScraperState.errors,
    screenScraperState.existingDevPassword,
    screenScraperState.existingPassword,
    screenScraperState.existingSecret,
    screenScraperState.values,
    settings.screenscraper,
  ]);

  const submitPersonalization = useCallback(async () => {
    const result = validatePersonalizationSection(personalizationState.values, settings.personalization);
    setPersonalizationState((previous) => ({ ...previous, errors: result.errors }));
    if (Object.keys(result.errors).length > 0) {
      applyStatus("personalization", { state: "error", message: "Fix validation errors." });
      return;
    }
    if (!result.changed || !result.data) {
      applyStatus("personalization", { state: "success", message: "No changes detected." });
      return;
    }
    await handleSettingsUpdate("personalization", { personalization: result.data });
  }, [
    applyStatus,
    handleSettingsUpdate,
    personalizationState.values,
    settings.personalization,
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      {loadError ? (
        <PixelNotice tone="danger">
          <span className="font-semibold uppercase tracking-widest">{loadError}</span>
        </PixelNotice>
      ) : null}
      <SectionCard
        title="System Profile"
        description="Update the instance name, timezone, and public base URL."
        status={statuses.systemProfile}
        submitting={isSubmitting.systemProfile}
        onSubmit={submitSystemProfile}
      >
        <Field
          label="Instance name"
          value={systemProfileState.values.instanceName}
          onChange={(value) =>
            setSystemProfileState((previous) => ({
              ...previous,
              values: { ...previous.values, instanceName: value },
            }))
          }
          error={systemProfileState.errors.instanceName}
          required
        />
        <Field
          label="Timezone"
          value={systemProfileState.values.timezone}
          onChange={(value) =>
            setSystemProfileState((previous) => ({
              ...previous,
              values: { ...previous.values, timezone: value },
            }))
          }
          error={systemProfileState.errors.timezone}
          required
        />
        <Field
          label="Base URL"
          hint="Optional. Must be a valid URL if provided."
          value={systemProfileState.values.baseUrl}
          onChange={(value) =>
            setSystemProfileState((previous) => ({
              ...previous,
              values: { ...previous.values, baseUrl: value },
            }))
          }
          error={systemProfileState.errors.baseUrl}
        />
      </SectionCard>

      <SectionCard
        title="Storage"
        description="Configure filesystem or S3-compatible buckets for ROMs and assets."
        status={statuses.storage}
        submitting={isSubmitting.storage}
        onSubmit={submitStorage}
      >
        <RadioGroup
          legend="Driver"
          options={[
            { label: "Filesystem", value: "filesystem" },
            { label: "S3-compatible", value: "s3" },
          ]}
          value={storageState.values.driver}
          onChange={(driver) =>
            setStorageState((previous) => ({
              ...previous,
              values: { ...previous.values, driver: driver as StorageDriver },
            }))
          }
        />
        {storageState.values.driver === "filesystem" ? (
          <>
            <Field
              label="Local root"
              value={storageState.values.localRoot}
              onChange={(value) =>
                setStorageState((previous) => ({
                  ...previous,
                  values: { ...previous.values, localRoot: value },
                }))
              }
              error={storageState.errors.localRoot}
              required
            />
            <StorageBucketFields
              state={storageState}
              setState={setStorageState}
            />
            <Field
              label="Signed URL TTL (seconds)"
              value={storageState.values.signedUrlTTLSeconds}
              onChange={(value) =>
                setStorageState((previous) => ({
                  ...previous,
                  values: { ...previous.values, signedUrlTTLSeconds: value },
                }))
              }
              error={storageState.errors.signedUrlTTLSeconds}
              inputMode="numeric"
            />
          </>
        ) : (
          <>
            <StorageBucketFields state={storageState} setState={setStorageState} />
            <Field
              label="S3 Endpoint"
              value={storageState.values.s3Endpoint}
              onChange={(value) =>
                setStorageState((previous) => ({
                  ...previous,
                  values: { ...previous.values, s3Endpoint: value },
                }))
              }
              error={storageState.errors.s3Endpoint}
              required
            />
            <Field
              label="S3 Region"
              value={storageState.values.s3Region}
              onChange={(value) =>
                setStorageState((previous) => ({
                  ...previous,
                  values: { ...previous.values, s3Region: value },
                }))
              }
              error={storageState.errors.s3Region}
              required
            />
            <Field
              label="Access key"
              value={storageState.values.s3AccessKey}
              onChange={(value) =>
                setStorageState((previous) => ({
                  ...previous,
                  values: { ...previous.values, s3AccessKey: value },
                }))
              }
              error={storageState.errors.s3AccessKey}
              required
            />
            <Field
              label="Secret key"
              value={storageState.values.s3SecretKey}
              onChange={(value) =>
                setStorageState((previous) => ({
                  ...previous,
                  values: { ...previous.values, s3SecretKey: value },
                }))
              }
              error={storageState.errors.s3SecretKey}
              type="password"
              placeholder={storageState.existingSecret ? "••••••••" : undefined}
              hint={
                storageState.existingSecret
                  ? "Leave blank to keep the existing secret key."
                  : undefined
              }
            />
            <Checkbox
              label="Force path-style requests"
              checked={storageState.values.s3ForcePathStyle}
              onChange={(checked) =>
                setStorageState((previous) => ({
                  ...previous,
                  values: { ...previous.values, s3ForcePathStyle: checked },
                }))
              }
            />
            <Field
              label="Signed URL TTL (seconds)"
              value={storageState.values.signedUrlTTLSeconds}
              onChange={(value) =>
                setStorageState((previous) => ({
                  ...previous,
                  values: { ...previous.values, signedUrlTTLSeconds: value },
                }))
              }
              error={storageState.errors.signedUrlTTLSeconds}
              inputMode="numeric"
            />
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Email"
        description="Configure outgoing email via SMTP or disable notifications entirely."
        status={statuses.email}
        submitting={isSubmitting.email}
        onSubmit={submitEmail}
      >
        <Select
          label="Provider"
          value={emailState.values.provider}
          onChange={(value) =>
            setEmailState((previous) => ({
              ...previous,
              values: { ...previous.values, provider: value as EmailSettings["provider"] },
            }))
          }
          options={[
            { value: "none", label: "None" },
            { value: "smtp", label: "SMTP" },
          ]}
        />
        {emailState.values.provider === "smtp" && (
          <>
            <Field
              label="SMTP host"
              value={emailState.values.host}
              onChange={(value) =>
                setEmailState((previous) => ({
                  ...previous,
                  values: { ...previous.values, host: value },
                }))
              }
              error={emailState.errors.host}
              required
            />
            <Field
              label="SMTP port"
              value={emailState.values.port}
              onChange={(value) =>
                setEmailState((previous) => ({
                  ...previous,
                  values: { ...previous.values, port: value },
                }))
              }
              error={emailState.errors.port}
              inputMode="numeric"
              required
            />
            <Select
              label="TLS mode"
              value={emailState.values.secure}
              onChange={(value) =>
                setEmailState((previous) => ({
                  ...previous,
                  values: { ...previous.values, secure: value as EmailSettingsFormValues["secure"] },
                }))
              }
              options={[
                { value: "none", label: "None" },
                { value: "starttls", label: "STARTTLS" },
                { value: "implicit", label: "Implicit TLS" },
              ]}
            />
            <Field
              label="From email"
              value={emailState.values.fromEmail}
              onChange={(value) =>
                setEmailState((previous) => ({
                  ...previous,
                  values: { ...previous.values, fromEmail: value },
                }))
              }
              error={emailState.errors.fromEmail}
              required
            />
            <Field
              label="From name"
              value={emailState.values.fromName}
              onChange={(value) =>
                setEmailState((previous) => ({
                  ...previous,
                  values: { ...previous.values, fromName: value },
                }))
              }
              error={emailState.errors.fromName}
            />
            <Checkbox
              label="Allow invalid certificates"
              checked={emailState.values.allowInvalidCerts}
              onChange={(checked) =>
                setEmailState((previous) => ({
                  ...previous,
                  values: { ...previous.values, allowInvalidCerts: checked },
                }))
              }
            />
            <Checkbox
              label="Require authentication"
              checked={emailState.values.enableAuth}
              onChange={(checked) =>
                setEmailState((previous) => ({
                  ...previous,
                  values: {
                    ...previous.values,
                    enableAuth: checked,
                    authUsername: checked ? previous.values.authUsername : "",
                    authPassword: "",
                  },
                }))
              }
            />
            {emailState.values.enableAuth && (
              <>
                <Field
                  label="Auth username"
                  value={emailState.values.authUsername}
                  onChange={(value) =>
                    setEmailState((previous) => ({
                      ...previous,
                      values: { ...previous.values, authUsername: value },
                    }))
                  }
                  error={emailState.errors.authUsername}
                  required
                />
                <Field
                  label="Auth password"
                  type="password"
                  value={emailState.values.authPassword}
                  onChange={(value) =>
                    setEmailState((previous) => ({
                      ...previous,
                      values: { ...previous.values, authPassword: value },
                    }))
                  }
                  error={emailState.errors.authPassword}
                  placeholder={emailState.existingPassword ? "••••••••" : undefined}
                  hint={
                    emailState.existingPassword
                      ? "Leave blank to keep the existing password."
                      : undefined
                  }
                />
              </>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Metrics"
        description="Enable telemetry export tokens and restrict collector CIDRs."
        status={statuses.metrics}
        submitting={isSubmitting.metrics}
        onSubmit={submitMetrics}
      >
        <Checkbox
          label="Enable metrics"
          checked={metricsState.values.enabled}
          onChange={(checked) =>
            setMetricsState((previous) => ({
              ...previous,
              values: { ...previous.values, enabled: checked },
            }))
          }
        />
        <Field
          label="Metrics token"
          hint="Required when metrics are enabled."
          value={metricsState.values.token}
          onChange={(value) =>
            setMetricsState((previous) => ({
              ...previous,
              values: { ...previous.values, token: value },
            }))
          }
          error={metricsState.errors.token}
        />
        <Textarea
          label="Allowed CIDRs"
          hint="One CIDR per line. Leave empty to allow the default collector."
          value={metricsState.values.allowedCidrs}
          onChange={(value) =>
            setMetricsState((previous) => ({
              ...previous,
              values: { ...previous.values, allowedCidrs: value },
            }))
          }
          error={metricsState.errors.allowedCidrs}
          rows={4}
        />
      </SectionCard>

      <SectionCard
        title="ScreenScraper"
        description="Manage ScreenScraper credentials and throttling preferences for metadata enrichment."
        status={statuses.screenscraper}
        submitting={isSubmitting.screenscraper}
        onSubmit={submitScreenScraper}
      >
        <Field
          label="Username"
          value={screenScraperState.values.username}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, username: value },
            }))
          }
          error={screenScraperState.errors.username}
        />
        <Field
          label="Password"
          type="password"
          value={screenScraperState.values.password}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, password: value },
            }))
          }
          error={screenScraperState.errors.password}
          placeholder={screenScraperState.existingPassword ? "••••••••" : undefined}
          hint={
            screenScraperState.existingPassword
              ? "Leave blank to keep the existing password."
              : undefined
          }
        />
        <Field
          label="Secret key"
          type="password"
          value={screenScraperState.values.secretKey}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, secretKey: value },
            }))
          }
          error={screenScraperState.errors.secretKey}
          placeholder={screenScraperState.existingSecret ? "••••••••" : undefined}
          hint={
            screenScraperState.existingSecret
              ? "Leave blank to keep the existing secret key."
              : undefined
          }
        />
        <Field
          label="Developer ID"
          value={screenScraperState.values.devId}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, devId: value },
            }))
          }
          error={screenScraperState.errors.devId}
        />
        <Field
          label="Developer password"
          type="password"
          value={screenScraperState.values.devPassword}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, devPassword: value },
            }))
          }
          error={screenScraperState.errors.devPassword}
          placeholder={screenScraperState.existingDevPassword ? "••••••••" : undefined}
          hint={
            screenScraperState.existingDevPassword
              ? "Leave blank to keep the existing developer password."
              : undefined
          }
        />
        <Field
          label="Base URL"
          value={screenScraperState.values.baseUrl}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, baseUrl: value },
            }))
          }
          error={screenScraperState.errors.baseUrl}
        />
        <NumberField
          label="Requests per minute"
          value={screenScraperState.values.requestsPerMinute}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, requestsPerMinute: value },
            }))
          }
          error={screenScraperState.errors.requestsPerMinute}
        />
        <NumberField
          label="Concurrency"
          value={screenScraperState.values.concurrency}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, concurrency: value },
            }))
          }
          error={screenScraperState.errors.concurrency}
        />
        <NumberField
          label="Timeout (ms)"
          value={screenScraperState.values.timeoutMs}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, timeoutMs: value },
            }))
          }
          error={screenScraperState.errors.timeoutMs}
        />
        <Textarea
          label="Language priority"
          hint="Order languages from highest to lowest priority."
          value={screenScraperState.values.languagePriority}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, languagePriority: value },
            }))
          }
          error={screenScraperState.errors.languagePriority}
          rows={3}
        />
        <Textarea
          label="Region priority"
          value={screenScraperState.values.regionPriority}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, regionPriority: value },
            }))
          }
          error={screenScraperState.errors.regionPriority}
          rows={3}
        />
        <Textarea
          label="Media types"
          value={screenScraperState.values.mediaTypes}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, mediaTypes: value },
            }))
          }
          error={screenScraperState.errors.mediaTypes}
          rows={3}
        />
        <Checkbox
          label="Prefer higher quality replacements"
          checked={screenScraperState.values.onlyBetterMedia}
          onChange={(checked) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, onlyBetterMedia: checked },
            }))
          }
        />
        <NumberField
          label="Max assets per type"
          value={screenScraperState.values.maxAssetsPerType}
          onChange={(value) =>
            setScreenScraperState((previous) => ({
              ...previous,
              values: { ...previous.values, maxAssetsPerType: value },
            }))
          }
          error={screenScraperState.errors.maxAssetsPerType}
        />
      </SectionCard>

      <SectionCard
        title="Personalization"
        description="Choose the default theme for shared surfaces."
        status={statuses.personalization}
        submitting={isSubmitting.personalization}
        onSubmit={submitPersonalization}
      >
        <Field
          label="Theme"
          value={personalizationState.values.theme}
          onChange={(value) =>
            setPersonalizationState((previous) => ({
              ...previous,
              values: { ...previous.values, theme: value },
            }))
          }
          error={personalizationState.errors.theme}
          hint="Enter a theme identifier, e.g. midnight-harbor."
        />
      </SectionCard>

      <PixelButton variant="ghost" onClick={() => { void refreshFromServer(); }}>
        Refresh from server
      </PixelButton>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
};

function Field({
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  placeholder,
  required,
  inputMode,
}: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs uppercase tracking-[0.3em] text-slate-300">
        {label}
        <input
          className="mt-1 w-full rounded-pixel border border-ink/40 bg-surface-sunken px-3 py-2 text-sm text-foreground shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-night"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          placeholder={placeholder}
          aria-invalid={Boolean(error) ? "true" : undefined}
          required={required}
          inputMode={inputMode}
        />
      </label>
      {hint ? <p className="text-xs text-slate-300/70">{hint}</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

type TextareaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  rows?: number;
};

function Textarea({ label, value, onChange, error, hint, rows = 4 }: TextareaProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs uppercase tracking-[0.3em] text-slate-300">
        {label}
        <textarea
          className="mt-1 w-full rounded-pixel border border-ink/40 bg-surface-sunken px-3 py-2 text-sm text-foreground shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-night"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          aria-invalid={Boolean(error) ? "true" : undefined}
        />
      </label>
      {hint ? <p className="text-xs text-slate-300/70">{hint}</p> : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-300">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border border-ink/40 text-primary focus:ring-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="text-[0.75rem] normal-case tracking-normal text-slate-200">{label}</span>
    </label>
  );
}

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs uppercase tracking-[0.3em] text-slate-300">
        {label}
        <select
          className="mt-1 w-full rounded-pixel border border-ink/40 bg-surface-sunken px-3 py-2 text-sm text-foreground shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-night"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

type RadioGroupProps = {
  legend: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
};

function RadioGroup({ legend, options, value, onChange }: RadioGroupProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs uppercase tracking-[0.3em] text-slate-300">{legend}</legend>
      <div className="flex flex-wrap gap-4">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="radio"
              name={legend}
              value={option.value}
              checked={value === option.value}
              onChange={(event) => event.target.checked && onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type StorageBucketFieldsProps = {
  state: SectionState<StorageSettingsFormValues>;
  setState: React.Dispatch<
    React.SetStateAction<
      SectionState<StorageSettingsFormValues> & { existingSecret?: string }
    >
  >;
};

function StorageBucketFields({ state, setState }: StorageBucketFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Assets bucket"
        value={state.values.bucketAssets}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            values: { ...previous.values, bucketAssets: value },
          }))
        }
        error={state.errors.bucketAssets}
        required
      />
      <Field
        label="ROMs bucket"
        value={state.values.bucketRoms}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            values: { ...previous.values, bucketRoms: value },
          }))
        }
        error={state.errors.bucketRoms}
        required
      />
      <Field
        label="BIOS bucket"
        value={state.values.bucketBios}
        onChange={(value) =>
          setState((previous) => ({
            ...previous,
            values: { ...previous.values, bucketBios: value },
          }))
        }
        error={state.errors.bucketBios}
      />
    </div>
  );
}

type NumberFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

function NumberField({ label, value, onChange, error }: NumberFieldProps) {
  return (
    <Field
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      inputMode="numeric"
    />
  );
}
