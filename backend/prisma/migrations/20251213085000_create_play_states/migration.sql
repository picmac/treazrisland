-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RomPlaybackAction') THEN
    CREATE TYPE "RomPlaybackAction" AS ENUM ('ROM_DOWNLOAD', 'ASSET_DOWNLOAD', 'PLAY_STATE_DOWNLOAD', 'PLAY_STATE_UPLOAD');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlayState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "romId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "label" TEXT,
    "slot" INTEGER,
    "size" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RomPlaybackAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "romId" TEXT,
    "romBinaryId" TEXT,
    "romAssetId" TEXT,
    "playStateId" TEXT,
    "action" "RomPlaybackAction" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RomPlaybackAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlayState_userId_idx" ON "PlayState"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlayState_romId_idx" ON "PlayState"("romId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "play_state_unique_slot" ON "PlayState"("userId", "romId", "slot");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RomPlaybackAudit_userId_idx" ON "RomPlaybackAudit"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RomPlaybackAudit_romId_idx" ON "RomPlaybackAudit"("romId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RomPlaybackAudit_romBinaryId_idx" ON "RomPlaybackAudit"("romBinaryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RomPlaybackAudit_romAssetId_idx" ON "RomPlaybackAudit"("romAssetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RomPlaybackAudit_playStateId_idx" ON "RomPlaybackAudit"("playStateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RomPlaybackAudit_createdAt_idx" ON "RomPlaybackAudit"("createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('"User"') IS NULL THEN
    RAISE EXCEPTION 'Required table "User" does not exist for PlayState_userId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlayState_userId_fkey'
  ) THEN
    ALTER TABLE "PlayState"
      ADD CONSTRAINT "PlayState_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('"Rom"') IS NULL THEN
    RAISE EXCEPTION 'Required table "Rom" does not exist for PlayState_romId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlayState_romId_fkey'
  ) THEN
    ALTER TABLE "PlayState"
      ADD CONSTRAINT "PlayState_romId_fkey"
      FOREIGN KEY ("romId") REFERENCES "Rom"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('"User"') IS NULL THEN
    RAISE EXCEPTION 'Required table "User" does not exist for RomPlaybackAudit_userId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RomPlaybackAudit_userId_fkey'
  ) THEN
    ALTER TABLE "RomPlaybackAudit"
      ADD CONSTRAINT "RomPlaybackAudit_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('"Rom"') IS NULL THEN
    RAISE EXCEPTION 'Required table "Rom" does not exist for RomPlaybackAudit_romId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RomPlaybackAudit_romId_fkey'
  ) THEN
    ALTER TABLE "RomPlaybackAudit"
      ADD CONSTRAINT "RomPlaybackAudit_romId_fkey"
      FOREIGN KEY ("romId") REFERENCES "Rom"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('"RomBinary"') IS NULL THEN
    RAISE EXCEPTION 'Required table "RomBinary" does not exist for RomPlaybackAudit_romBinaryId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RomPlaybackAudit_romBinaryId_fkey'
  ) THEN
    ALTER TABLE "RomPlaybackAudit"
      ADD CONSTRAINT "RomPlaybackAudit_romBinaryId_fkey"
      FOREIGN KEY ("romBinaryId") REFERENCES "RomBinary"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('"RomAsset"') IS NULL THEN
    RAISE EXCEPTION 'Required table "RomAsset" does not exist for RomPlaybackAudit_romAssetId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RomPlaybackAudit_romAssetId_fkey'
  ) THEN
    ALTER TABLE "RomPlaybackAudit"
      ADD CONSTRAINT "RomPlaybackAudit_romAssetId_fkey"
      FOREIGN KEY ("romAssetId") REFERENCES "RomAsset"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('"PlayState"') IS NULL THEN
    RAISE EXCEPTION 'Required table "PlayState" does not exist for RomPlaybackAudit_playStateId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RomPlaybackAudit_playStateId_fkey'
  ) THEN
    ALTER TABLE "RomPlaybackAudit"
      ADD CONSTRAINT "RomPlaybackAudit_playStateId_fkey"
      FOREIGN KEY ("playStateId") REFERENCES "PlayState"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- privilege-reviewed: 2025-02-28 security hardening checklist automation
