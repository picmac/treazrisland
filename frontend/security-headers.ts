export type ContentSecurityPolicyOptions = {
  nonce?: string;
  mediaCdn?: string | null;
};

function isTlsEnabled(): boolean {
  const rawTlsMode = process.env.TREAZ_TLS_MODE?.toLowerCase();
  return (
    rawTlsMode === "https" || rawTlsMode === "true" || rawTlsMode === "1"
  );
}

function normalizeOrigin(value?: string | null): string | null {
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

function serializeDirective(name: string, sources: Iterable<string>): string {
  const sourceList = Array.from(new Set(sources)).filter(Boolean);
  return `${name} ${sourceList.join(" ")}`.trim();
}

export function createContentSecurityPolicy(options: ContentSecurityPolicyOptions = {}): string {
  const tlsEnabled = isTlsEnabled();
  const { nonce, mediaCdn = process.env.NEXT_PUBLIC_MEDIA_CDN ?? null } = options;
  const mediaCdnOrigin = normalizeOrigin(mediaCdn);

  const scriptSrc = new Set(["'self'", "https:", "blob:"]);
  if (nonce) {
    scriptSrc.add(`'nonce-${nonce}'`);
    scriptSrc.add("'strict-dynamic'");
  } else {
    scriptSrc.add("'unsafe-inline'");
  }

  const styleSrc = new Set(["'self'", "'unsafe-inline'"]);
  const imgSrc = new Set(["'self'", "data:", "blob:", "https:"]);
  const fontSrc = new Set(["'self'", "data:"]);
  const connectSrc = new Set(["'self'", "https:", "http:"]);
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

export function buildSecurityHeaders(options?: ContentSecurityPolicyOptions) {
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
