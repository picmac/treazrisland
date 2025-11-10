-- Introduce runtime system settings storage and setup state tracking.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SetupStepStatus') THEN
    CREATE TYPE "SetupStepStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SystemSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SystemSetting_key_key" UNIQUE ("key")
);

DO $$
BEGIN
  IF to_regclass('"SystemSetting"') IS NULL THEN
    RAISE EXCEPTION 'Required table "SystemSetting" does not exist for SystemSetting_updatedById_fkey';
  END IF;

  IF to_regclass('"User"') IS NULL THEN
    RAISE EXCEPTION 'Required table "User" does not exist for SystemSetting_updatedById_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SystemSetting_updatedById_fkey'
  ) THEN
    ALTER TABLE "SystemSetting"
      ADD CONSTRAINT "SystemSetting_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SetupState" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "setupComplete" BOOLEAN NOT NULL DEFAULT false,
  "steps" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SetupState_pkey" PRIMARY KEY ("id")
);
-- privilege-reviewed: 2025-02-28 security hardening checklist automation
