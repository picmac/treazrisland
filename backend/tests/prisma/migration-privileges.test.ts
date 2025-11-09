import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_PATTERNS = [
  /\bCREATE\s+ROLE\b/i,
  /\bALTER\s+ROLE\b/i,
  /\bGRANT\s+(?!USAGE\s+ON\s+SEQUENCE)/i,
];

describe("Prisma migration privilege review", () => {
  it("documents privilege review and avoids direct grants", async () => {
    const prismaDir = resolve(__dirname, "../..", "prisma", "migrations");
    const entries = await readdir(prismaDir, { withFileTypes: true });

    const migrationFiles = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(prismaDir, entry.name, "migration.sql"));

    expect(migrationFiles.length).toBeGreaterThan(0);

    for (const filePath of migrationFiles) {
      const sql = await readFile(filePath, "utf8");
      expect(sql).toMatch(/--\s*privilege-reviewed:/i);
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(sql).not.toMatch(pattern);
      }
    }
  });
});
