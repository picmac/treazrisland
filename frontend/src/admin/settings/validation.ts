import {
  type EmailSettings,
  type MetricsSettings,
  type PersonalizationSettings,
  type ScreenScraperSettings,
  type StorageSettings,
  type SystemProfileSettings,
} from "@/src/lib/api/admin/settings";

interface SectionValidationResult<T> {
  data: T | null;
  errors: Record<string, string>;
  changed: boolean;
}

export function normalizeForComparison<T>(value: T): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForComparison(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .map(([key, child]) => [key, normalizeForComparison(child)] as const)
      .sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries);
  }
  return value;
}

function isChanged<T>(current: T, next: T): boolean {
  return JSON.stringify(normalizeForComparison(current)) !== JSON.stringify(normalizeForComparison(next));
}

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SystemProfileSettingsFormValues = {
  instanceName: string;
  timezone: string;
  baseUrl: string;
};

export function validateSystemProfileSection(
  values: SystemProfileSettingsFormValues,
  current: SystemProfileSettings,
): SectionValidationResult<SystemProfileSettings> {
  const errors: Record<string, string> = {};
  const instanceName = values.instanceName.trim();
  const timezone = values.timezone.trim();
  const baseUrl = values.baseUrl.trim();

  if (!instanceName) {
    errors.instanceName = "Instance name is required.";
  }
  if (!timezone) {
    errors.timezone = "Timezone is required.";
  }
  if (baseUrl) {
    try {
      // eslint-disable-next-line no-new
      new URL(baseUrl);
    } catch {
      errors.baseUrl = "Enter a valid URL.";
    }
  }

  const sanitized: SystemProfileSettings = {
    instanceName,
    timezone,
    ...(baseUrl ? { baseUrl } : {}),
  };

  return {
    data: Object.keys(errors).length > 0 ? null : sanitized,
    errors,
    changed: Object.keys(errors).length === 0 && isChanged(current, sanitized),
  };
}

export type StorageSettingsFormValues = {
  driver: StorageSettings["driver"];
  localRoot: string;
  bucketAssets: string;
  bucketRoms: string;
  bucketBios: string;
  signedUrlTTLSeconds: string;
  s3Endpoint: string;
  s3Region: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3ForcePathStyle: boolean;
};

export function validateStorageSection(
  values: StorageSettingsFormValues,
  current: StorageSettings,
  existingSecret?: string,
): SectionValidationResult<StorageSettings> {
  const errors: Record<string, string> = {};
  const driver = values.driver;
  const localRoot = values.localRoot.trim();
  const bucketAssets = values.bucketAssets.trim();
  const bucketRoms = values.bucketRoms.trim();
  const bucketBios = values.bucketBios.trim();
  const signedUrlTTL = values.signedUrlTTLSeconds.trim();

  if (!bucketAssets) {
    errors.bucketAssets = "Assets bucket is required.";
  }
  if (!bucketRoms) {
    errors.bucketRoms = "ROM bucket is required.";
  }

  let signedUrlTTLSeconds: number | undefined;
  if (signedUrlTTL) {
    const parsed = Number.parseInt(signedUrlTTL, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.signedUrlTTLSeconds = "Enter a positive integer.";
    } else {
      signedUrlTTLSeconds = parsed;
    }
  }

  const sanitized: StorageSettings = {
    driver,
    localRoot: driver === "filesystem" ? localRoot : current.localRoot ?? "",
    bucketAssets,
    bucketRoms,
    ...(bucketBios ? { bucketBios } : {}),
    ...(signedUrlTTLSeconds ? { signedUrlTTLSeconds } : {}),
  };

  if (driver === "filesystem") {
    if (!localRoot) {
      errors.localRoot = "Local root is required.";
    }
  } else {
    const endpoint = values.s3Endpoint.trim();
    const region = values.s3Region.trim();
    const accessKey = values.s3AccessKey.trim();
    const secretKeyInput = values.s3SecretKey.trim();
    let secretKey = secretKeyInput || existingSecret || "";

    if (!endpoint) {
      errors.s3Endpoint = "Endpoint is required.";
    } else {
      try {
        // eslint-disable-next-line no-new
        new URL(endpoint);
      } catch {
        errors.s3Endpoint = "Enter a valid URL.";
      }
    }
    if (!region) {
      errors.s3Region = "Region is required.";
    }
    if (!accessKey) {
      errors.s3AccessKey = "Access key is required.";
    }
    if (!secretKey) {
      errors.s3SecretKey = "Secret key is required.";
    }

    if (!errors.s3SecretKey && secretKeyInput) {
      secretKey = secretKeyInput;
    }

    sanitized.s3 = {
      endpoint,
      region,
      accessKey,
      secretKey,
      forcePathStyle: values.s3ForcePathStyle,
    };
  }

  const hasErrors = Object.keys(errors).length > 0;
  return {
    data: hasErrors ? null : sanitized,
    errors,
    changed: !hasErrors && isChanged(current, sanitized),
  };
}

export type EmailSettingsFormValues = {
  provider: EmailSettings["provider"];
  host: string;
  port: string;
  secure: "none" | "starttls" | "implicit";
  fromEmail: string;
  fromName: string;
  allowInvalidCerts: boolean;
  enableAuth: boolean;
  authUsername: string;
  authPassword: string;
};

export function validateEmailSection(
  values: EmailSettingsFormValues,
  current: EmailSettings,
  existingPassword?: string,
): SectionValidationResult<EmailSettings> {
  const errors: Record<string, string> = {};

  if (values.provider === "none") {
    const sanitized: EmailSettings = { provider: "none" };
    return {
      data: sanitized,
      errors,
      changed: isChanged(current, sanitized),
    };
  }

  const host = values.host.trim();
  const portRaw = values.port.trim();
  const fromEmail = values.fromEmail.trim();
  const fromName = values.fromName.trim();

  if (!host) {
    errors.host = "Host is required.";
  }

  let port: number | undefined;
  if (!portRaw) {
    errors.port = "Port is required.";
  } else {
    const parsed = Number.parseInt(portRaw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.port = "Enter a valid port.";
    } else {
      port = parsed;
    }
  }

  if (!fromEmail) {
    errors.fromEmail = "From email is required.";
  } else if (!EMAIL_REGEX.test(fromEmail)) {
    errors.fromEmail = "Enter a valid email.";
  }

  let authUsername: string | undefined;
  let authPassword: string | undefined;

  if (values.enableAuth) {
    authUsername = values.authUsername.trim();
    const passwordInput = values.authPassword.trim();
    const fallback = existingPassword?.trim();

    if (!authUsername) {
      errors.authUsername = "Username is required.";
    }
    if (passwordInput) {
      authPassword = passwordInput;
    } else if (fallback) {
      authPassword = fallback;
    } else {
      errors.authPassword = "Password is required.";
    }
  }

  const sanitized: EmailSettings = {
    provider: "smtp",
    smtp: {
      host,
      port,
      secure: values.secure,
      fromEmail,
      ...(fromName ? { fromName } : {}),
      allowInvalidCerts: values.allowInvalidCerts,
      ...(values.enableAuth && authUsername && authPassword
        ? { auth: { username: authUsername, password: authPassword } }
        : {}),
    },
  };

  const hasErrors = Object.keys(errors).length > 0;
  return {
    data: hasErrors ? null : sanitized,
    errors,
    changed: !hasErrors && isChanged(current, sanitized),
  };
}

export type MetricsSettingsFormValues = {
  enabled: boolean;
  token: string;
  allowedCidrs: string;
};

export function validateMetricsSection(
  values: MetricsSettingsFormValues,
  current: MetricsSettings,
): SectionValidationResult<MetricsSettings> {
  const errors: Record<string, string> = {};
  const token = values.token.trim();
  const allowedCidrs = values.allowedCidrs
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (values.enabled && !token) {
    errors.token = "Token is required when metrics are enabled.";
  }

  const sanitized: MetricsSettings = {
    enabled: values.enabled,
    ...(token ? { token } : {}),
    allowedCidrs,
  };

  return {
    data: Object.keys(errors).length > 0 ? null : sanitized,
    errors,
    changed: Object.keys(errors).length === 0 && isChanged(current, sanitized),
  };
}

export type ScreenScraperFormValues = {
  username: string;
  password: string;
  secretKey: string;
  devId: string;
  devPassword: string;
  baseUrl: string;
  requestsPerMinute: string;
  concurrency: string;
  timeoutMs: string;
  languagePriority: string;
  regionPriority: string;
  mediaTypes: string;
  onlyBetterMedia: boolean;
  maxAssetsPerType: string;
};

interface ScreenScraperSecretState {
  existingPassword?: string;
  existingSecret?: string;
  existingDevPassword?: string;
}

export function validateScreenScraperSection(
  values: ScreenScraperFormValues,
  current: ScreenScraperSettings,
  existing: ScreenScraperSecretState,
): SectionValidationResult<ScreenScraperSettings> {
  const errors: Record<string, string> = {};

  const baseUrl = values.baseUrl.trim();
  if (baseUrl) {
    try {
      // eslint-disable-next-line no-new
      new URL(baseUrl);
    } catch {
      errors.baseUrl = "Enter a valid URL.";
    }
  }

  const languagePriority = splitList(values.languagePriority);
  const regionPriority = splitList(values.regionPriority);
  const mediaTypes = splitList(values.mediaTypes);

  const requestsPerMinute = parseOptionalPositiveInt(values.requestsPerMinute, "requestsPerMinute", errors);
  const concurrency = parseOptionalPositiveInt(values.concurrency, "concurrency", errors);
  const timeoutMs = parseOptionalPositiveInt(values.timeoutMs, "timeoutMs", errors);
  const maxAssetsPerType = parseOptionalPositiveInt(values.maxAssetsPerType, "maxAssetsPerType", errors);

  const sanitized: ScreenScraperSettings = {};

  const username = values.username.trim();
  if (username) {
    sanitized.username = username;
  }

  const passwordInput = values.password.trim();
  const passwordFallback = existing.existingPassword ?? current.password;
  if (passwordInput) {
    sanitized.password = passwordInput;
  } else if (passwordFallback) {
    sanitized.password = passwordFallback;
  }

  const secretInput = values.secretKey.trim();
  const secretFallback = existing.existingSecret ?? current.secretKey;
  if (secretInput) {
    sanitized.secretKey = secretInput;
  } else if (secretFallback) {
    sanitized.secretKey = secretFallback;
  }

  const devId = values.devId.trim();
  if (devId) {
    sanitized.devId = devId;
  }

  const devPasswordInput = values.devPassword.trim();
  const devPasswordFallback = existing.existingDevPassword ?? current.devPassword;
  if (devPasswordInput) {
    sanitized.devPassword = devPasswordInput;
  } else if (devPasswordFallback) {
    sanitized.devPassword = devPasswordFallback;
  }

  if (baseUrl) {
    sanitized.baseUrl = baseUrl;
  }
  if (requestsPerMinute !== undefined) {
    sanitized.requestsPerMinute = requestsPerMinute;
  }
  if (concurrency !== undefined) {
    sanitized.concurrency = concurrency;
  }
  if (timeoutMs !== undefined) {
    sanitized.timeoutMs = timeoutMs;
  }
  if (languagePriority.length > 0) {
    sanitized.languagePriority = languagePriority;
  }
  if (regionPriority.length > 0) {
    sanitized.regionPriority = regionPriority;
  }
  if (mediaTypes.length > 0) {
    sanitized.mediaTypes = mediaTypes;
  }
  if (values.onlyBetterMedia || current.onlyBetterMedia !== undefined) {
    sanitized.onlyBetterMedia = values.onlyBetterMedia;
  }
  if (maxAssetsPerType !== undefined) {
    sanitized.maxAssetsPerType = maxAssetsPerType;
  }

  const hasErrors = Object.keys(errors).length > 0;
  return {
    data: hasErrors ? null : sanitized,
    errors,
    changed: !hasErrors && isChanged(current, sanitized),
  };
}

export type PersonalizationFormValues = {
  theme: string;
};

export function validatePersonalizationSection(
  values: PersonalizationFormValues,
  current: PersonalizationSettings,
): SectionValidationResult<PersonalizationSettings> {
  const theme = values.theme.trim();
  const sanitized: PersonalizationSettings = theme ? { theme } : {};
  return {
    data: sanitized,
    errors: {},
    changed: isChanged(current, sanitized),
  };
}

function splitList(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseOptionalPositiveInt(
  value: string,
  field: keyof ScreenScraperSettings,
  errors: Record<string, string>,
): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors[field as string] = "Enter a positive integer.";
    return undefined;
  }
  return parsed;
}
