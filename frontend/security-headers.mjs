// @ts-check

/**
 * @typedef {Object} ContentSecurityPolicyOptions
 * @property {string=} nonce
 * @property {string|null=} mediaCdn
 */

const TLS_ENABLED_VALUES = new Set(["https", "true", "1", "on"]);
const TLS_DISABLED_VALUES = new Set(["http", "false", "0", "off"]);
const TLS_AUTOMATIC_VALUES = new Set(["auto", "automatic", "lan"]);

const RUNTIME_STAGE_ALIASES = new Map([
  ["production", "production"],
  ["prod", "production"],
  ["internet", "production"],
  ["external", "production"],
  ["public", "production"],
  ["development", "development"],
  ["dev", "development"],
  ["lan", "development"],
  ["local", "development"],
  ["test", "test"],
]);

/**
 * @returns {"production" | "development" | "test"}
 */
function resolveRuntimeStage() {
  const rawStage = process.env.TREAZ_RUNTIME_ENV;
  if (rawStage && rawStage.trim().length > 0) {
    const normalized = rawStage.trim().toLowerCase();
    const stage = RUNTIME_STAGE_ALIASES.get(normalized);
    if (stage) {
      return stage;
    }

    const message =
      `Unsupported TREAZ_RUNTIME_ENV value "${rawStage}". Accepted values: production, prod, internet, external, public, development, dev, lan, local, test.`;
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }

    console.warn(
      `[security-headers] ${message} Defaulting to production-mode directives.`,
    );
    return "production";
  }

  const githubActionsFlag = process.env.GITHUB_ACTIONS?.trim().toLowerCase();
  if (githubActionsFlag === "true") {
    const tlsMode = process.env.TREAZ_TLS_MODE?.trim().toLowerCase();
    if (!tlsMode || TLS_AUTOMATIC_VALUES.has(tlsMode) || TLS_DISABLED_VALUES.has(tlsMode)) {
      return "development";
    }
  }

  const rawNodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  if (rawNodeEnv === "production" || rawNodeEnv === "development") {
    return rawNodeEnv;
  }

  if (rawNodeEnv === "test") {
    return "test";
  }

  return "development";
}

/**
 * @returns {boolean}
 */
function isTlsEnabled() {
  const raw = process.env.TREAZ_TLS_MODE;
  const runtimeStage = resolveRuntimeStage();
  if (!raw || raw.trim().length === 0) {
    return runtimeStage === "production";
  }

  const normalized = raw.trim().toLowerCase();
  if (TLS_ENABLED_VALUES.has(normalized)) {
    return true;
  }

  if (TLS_DISABLED_VALUES.has(normalized)) {
    return false;
  }

  if (TLS_AUTOMATIC_VALUES.has(normalized)) {
    return runtimeStage === "production";
  }

  const message =
    `Unsupported TREAZ_TLS_MODE value "${raw}". Accepted values: https, http, true, false, 1, 0, auto.`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }

  console.warn(`[security-headers] ${message} Defaulting to strict HTTPS headers.`);
  return true;
}

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
function normalizeOrigin(value) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.origin;
  } catch (error) {
    console.warn(
      "[security-headers] Skipped invalid origin for CSP directive:",
      value,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * @param {string} name
 * @param {Iterable<string>} sources
 * @returns {string}
 */
function serializeDirective(name, sources) {
  const sourceList = Array.from(new Set(sources)).filter(Boolean);
  return `${name} ${sourceList.join(" ")}`.trim();
}

/**
 * @param {ContentSecurityPolicyOptions=} options
 * @returns {string}
 */
export function createContentSecurityPolicy(options = {}) {
  const tlsEnabled = isTlsEnabled();
  const runtimeStage = resolveRuntimeStage();
  const { nonce, mediaCdn = process.env.NEXT_PUBLIC_MEDIA_CDN ?? null } = options;
  const mediaCdnOrigin = normalizeOrigin(mediaCdn);

  const scriptSrc = new Set(["'self'", "https:", "blob:"]);
  if (nonce) {
    scriptSrc.add(`'nonce-${nonce}'`);
    if (runtimeStage === "production") {
      scriptSrc.add("'strict-dynamic'");
    } else {
      scriptSrc.add("'unsafe-inline'");
    }
  } else {
    scriptSrc.add("'unsafe-inline'");
  }

  const styleSrc = new Set(["'self'", "'unsafe-inline'"]);
  const imgSrc = new Set(["'self'", "data:", "blob:", "https:"]);
  const fontSrc = new Set(["'self'", "data:"]);
  const connectSrc = new Set(["'self'", "https:", "wss:"]);
  if (!tlsEnabled) {
    connectSrc.add("http:");
    connectSrc.add("ws:");
  }
  const mediaSrc = new Set(["'self'", "blob:"]);
  const frameSrc = new Set(["'self'"]);
  const workerSrc = new Set(["'self'", "blob:"]);

  if (mediaCdnOrigin) {
    imgSrc.add(mediaCdnOrigin);
    connectSrc.add(mediaCdnOrigin);
    mediaSrc.add(mediaCdnOrigin);
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    serializeDirective("img-src", imgSrc),
    serializeDirective("font-src", fontSrc),
    serializeDirective("script-src", scriptSrc),
    serializeDirective("style-src", styleSrc),
    serializeDirective("connect-src", connectSrc),
    serializeDirective("media-src", mediaSrc),
    serializeDirective("frame-src", frameSrc),
    serializeDirective("worker-src", workerSrc),
    "object-src 'none'",
    "manifest-src 'self'",
    "child-src 'self' blob:",
    "report-uri /api/csp-report"
  ];

  if (tlsEnabled) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

/**
 * @param {ContentSecurityPolicyOptions=} options
 * @returns {{ key: string, value: string }[]}
 */
export function buildSecurityHeaders(options) {
  const tlsEnabled = isTlsEnabled();
  const headers = [
    {
      key: "Content-Security-Policy",
      value: createContentSecurityPolicy(options)
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff"
    },
    {
      key: "X-Frame-Options",
      value: "DENY"
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin"
    }
  ];

  if (tlsEnabled) {
    headers.splice(1, 0, {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload"
    });
  }

  return headers;
}
