const SUPPORTED_CONTENT_TYPES = new Set([
  "application/json",
  "application/csp-report"
]);

type RawCspReport = Record<string, unknown> & {
  "document-uri"?: unknown;
  referrer?: unknown;
  "blocked-uri"?: unknown;
  "violated-directive": unknown;
  "effective-directive"?: unknown;
  "original-policy": unknown;
  disposition?: unknown;
  "status-code"?: unknown;
  "source-file"?: unknown;
  "line-number"?: unknown;
  "column-number"?: unknown;
};

type NormalizedCspReport = {
  documentUri?: string;
  referrer?: string;
  blockedUri?: string;
  violatedDirective: string;
  effectiveDirective?: string;
  originalPolicy: string;
  disposition?: string;
  statusCode?: number;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
};

export async function POST(request: Request): Promise<Response> {
  const contentType = normalizeContentType(request.headers.get("content-type"));
  if (!contentType || !SUPPORTED_CONTENT_TYPES.has(contentType)) {
    return jsonResponse({ error: "Unsupported content type" }, { status: 415 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse CSP report payload", error);
    return jsonResponse({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parseResult = parseCspReportPayload(payload);
  if (!parseResult.success) {
    return jsonResponse({ error: parseResult.error }, { status: 400 });
  }

  const report = parseResult.value;
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const clientIp = extractClientIp(request.headers.get("x-forwarded-for"));
  const receivedAt = new Date().toISOString();

  const structuredPayload = {
    kind: "security.csp-report",
    receivedAt,
    userAgent,
    clientIp,
    report
  } satisfies Record<string, unknown>;

  const observabilityEndpoint = process.env.OBSERVABILITY_CSP_ENDPOINT;
  const observabilityToken = process.env.OBSERVABILITY_CSP_TOKEN;

  if (observabilityEndpoint) {
    try {
      const headers = new Headers();
      headers.set("content-type", "application/json");
      if (observabilityToken) {
        headers.set("authorization", `Bearer ${observabilityToken}`);
      }

      const response = await fetch(observabilityEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(structuredPayload),
        cache: "no-store"
      });

      if (!response.ok) {
        console.error(
          "Observability endpoint rejected CSP report",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Failed to forward CSP report to observability endpoint", error);
    }
  } else {
    console.info("CSP report received", {
      ...structuredPayload,
      report: sanitizeForLogging(report)
    });
  }

  return new Response(null, { status: 204 });
}

export async function GET(): Promise<Response> {
  return methodNotAllowedResponse();
}

export async function PUT(): Promise<Response> {
  return methodNotAllowedResponse();
}

export async function DELETE(): Promise<Response> {
  return methodNotAllowedResponse();
}

export async function PATCH(): Promise<Response> {
  return methodNotAllowedResponse();
}

function parseCspReportPayload(payload: unknown):
  | { success: true; value: NormalizedCspReport }
  | { success: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { success: false, error: "Payload must be an object" };
  }

  const root = payload as Record<string, unknown>;
  const candidate = root["csp-report"];
  if (!candidate || typeof candidate !== "object") {
    return { success: false, error: 'Expected "csp-report" object' };
  }

  const raw = candidate as RawCspReport;

  const violatedDirective = ensureString(raw["violated-directive"], "violated-directive");
  const originalPolicy = ensureString(raw["original-policy"], "original-policy");

  if (!violatedDirective.success) {
    return violatedDirective;
  }
  if (!originalPolicy.success) {
    return originalPolicy;
  }

  const report: NormalizedCspReport = {
    violatedDirective: violatedDirective.value,
    originalPolicy: originalPolicy.value
  };

  assignOptionalString(raw, report, "document-uri", "documentUri");
  assignOptionalString(raw, report, "referrer", "referrer");
  assignOptionalString(raw, report, "blocked-uri", "blockedUri");
  assignOptionalString(raw, report, "effective-directive", "effectiveDirective");
  assignOptionalString(raw, report, "disposition", "disposition");
  assignOptionalString(raw, report, "source-file", "sourceFile");
  assignOptionalNumber(raw, report, "status-code", "statusCode");
  assignOptionalNumber(raw, report, "line-number", "lineNumber");
  assignOptionalNumber(raw, report, "column-number", "columnNumber");

  return { success: true, value: report };
}

function assignOptionalString(
  source: RawCspReport,
  target: NormalizedCspReport,
  key: keyof RawCspReport,
  targetKey: keyof NormalizedCspReport
) {
  const value = source[key];
  if (typeof value === "string" && value.trim() !== "") {
    (target[targetKey] as string | undefined) = value;
  }
}

function assignOptionalNumber(
  source: RawCspReport,
  target: NormalizedCspReport,
  key: keyof RawCspReport,
  targetKey: keyof NormalizedCspReport
) {
  const value = source[key];
  const parsed = coerceNumber(value);
  if (typeof parsed === "number") {
    (target[targetKey] as number | undefined) = parsed;
  }
}

function ensureString(
  value: unknown,
  field: string
): { success: false; error: string } | { success: true; value: string } {
  if (typeof value !== "string" || value.trim() === "") {
    return { success: false, error: `Field "${field}" must be a non-empty string` };
  }

  return { success: true, value: value.trim() };
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return undefined;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeContentType(contentType: string | null): string | null {
  if (!contentType) {
    return null;
  }
  const [type] = contentType.split(";");
  return type.trim().toLowerCase();
}

function jsonResponse(
  body: Record<string, unknown>,
  init: ResponseInit
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
}

function methodNotAllowedResponse(): Response {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST" }
  });
}

function extractClientIp(header: string | null): string | undefined {
  if (!header) {
    return undefined;
  }

  const first = header.split(",")[0]?.trim();
  return first && first.length > 0 ? first : undefined;
}

function sanitizeForLogging(report: NormalizedCspReport): NormalizedCspReport {
  const safeReport: NormalizedCspReport = {
    violatedDirective: report.violatedDirective,
    originalPolicy: report.originalPolicy
  };

  if (report.documentUri) safeReport.documentUri = report.documentUri;
  if (report.referrer) safeReport.referrer = report.referrer;
  if (report.blockedUri) safeReport.blockedUri = report.blockedUri;
  if (report.effectiveDirective) safeReport.effectiveDirective = report.effectiveDirective;
  if (report.disposition) safeReport.disposition = report.disposition;
  if (report.statusCode !== undefined) safeReport.statusCode = report.statusCode;
  if (report.sourceFile) safeReport.sourceFile = report.sourceFile;
  if (report.lineNumber !== undefined) safeReport.lineNumber = report.lineNumber;
  if (report.columnNumber !== undefined) safeReport.columnNumber = report.columnNumber;

  return safeReport;
}
