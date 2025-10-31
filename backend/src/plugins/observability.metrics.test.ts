import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { FastifyInstance } from "fastify";

import type { ObservabilityMetrics } from "./observability.js";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "test-secret-32-characters-minimum-value";
process.env.JWT_ACCESS_TTL = "15m";
process.env.JWT_REFRESH_TTL = "30d";
process.env.PASSWORD_RESET_TTL = "1h";
process.env.USER_INVITE_EXPIRY_HOURS = "24";
process.env.STORAGE_DRIVER = "filesystem";
process.env.STORAGE_BUCKET_ASSETS = "assets";
process.env.STORAGE_BUCKET_ROMS = "roms";
process.env.STORAGE_BUCKET_BIOS = "bios";
process.env.ROM_UPLOAD_MAX_BYTES = `${1024 * 1024}`;
process.env.MFA_ISSUER = "TREAZRISLAND";
process.env.MFA_RECOVERY_CODE_COUNT = "4";
process.env.MFA_RECOVERY_CODE_LENGTH = "8";
process.env.METRICS_ENABLED = "true";
process.env.METRICS_TOKEN = "test-metrics-token";
process.env.METRICS_ALLOWED_CIDRS = "10.10.0.0/16,127.0.0.1/32";

let buildServer: typeof import("../server.js").buildServer;

describe("observability metrics formatting", () => {
  let app: FastifyInstance & { metrics: ObservabilityMetrics };

  beforeAll(async () => {
    ({ buildServer } = await import("../server.js"));
  });

  beforeEach(async () => {
    app = buildServer({ registerPrisma: false }) as FastifyInstance & {
      metrics: ObservabilityMetrics;
    };
    app.decorate("prisma", {
      loginAudit: { create: async () => ({}) },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("renders empty histogram buckets with valid labels", () => {
    const metrics = app.metrics;
    const output = metrics.render();

    expect(output).toContain(
      'treaz_http_request_duration_seconds_bucket{method="",route="",status_code="",le="0.05"} 0',
    );
    expect(output).toContain(
      'treaz_http_request_duration_seconds_bucket{method="",route="",status_code="",le="+Inf"} 0',
    );
    expect(output).not.toContain("}{le=");
  });

  it("renders populated histogram buckets with closing braces", () => {
    const metrics = app.metrics;

    metrics.httpRequestDuration.observe(
      { method: "GET", route: "/library", status_code: "200" },
      0.2,
    );

    const output = metrics.render();
    const bucketLines = output
      .split("\n")
      .filter((line) =>
        line.startsWith(
          'treaz_http_request_duration_seconds_bucket{method="GET",route="/library",status_code="200"',
        ),
      );

    expect(bucketLines.length).toBeGreaterThan(0);
    for (const line of bucketLines) {
      expect(line).toMatch(/}\s\d+$/);
    }

    const matchingBucket = bucketLines.find((line) => line.includes('le="0.25"'));
    expect(matchingBucket).toBeDefined();
    expect(matchingBucket).toMatch(/ 1$/);
  });
});
