-- Introduce runtime system settings storage and setup state tracking.
CREATE TYPE "SetupStepStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

CREATE TABLE "SystemSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SystemSetting_key_key" UNIQUE ("key")
);

ALTER TABLE "SystemSetting"
  ADD CONSTRAINT "SystemSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SetupState" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "setupComplete" BOOLEAN NOT NULL DEFAULT false,
  "steps" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SetupState_pkey" PRIMARY KEY ("id")
);
