-- CreateEnum
CREATE TYPE "EnrichmentProvider" AS ENUM ('SCREEN_SCRAPER', 'MANUAL');

-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RomBinaryStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "RomUploadStatus" AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RomUploadKind" AS ENUM ('ROM', 'BIOS');

-- CreateEnum
CREATE TYPE "RomAssetType" AS ENUM ('COVER', 'LOGO', 'SCREENSHOT', 'VIDEO', 'MANUAL', 'WHEEL', 'MARQUEE', 'MAP', 'OTHER');

-- CreateEnum
CREATE TYPE "RomAssetSource" AS ENUM ('SCREEN_SCRAPER', 'USER_UPLOAD', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "LoginAuditEvent" AS ENUM ('SUCCESS', 'FAILURE', 'MFA_REQUIRED', 'LOGOUT', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "RefreshToken"
    ADD COLUMN "familyId" TEXT,
    ADD COLUMN "revokedReason" TEXT;

-- CreateTable
CREATE TABLE "RefreshTokenFamily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "RefreshTokenFamily_pkey" PRIMARY KEY ("id")
);

-- Backfill refresh token families for existing rows
WITH tokens AS (
    SELECT "id", "userId", COALESCE("createdAt", CURRENT_TIMESTAMP) AS "createdAt"
    FROM "RefreshToken"
)
INSERT INTO "RefreshTokenFamily" ("id", "userId", "createdAt")
SELECT 'legacy_' || "id", "userId", "createdAt"
FROM tokens
ON CONFLICT DO NOTHING;

UPDATE "RefreshToken"
SET "familyId" = 'legacy_' || "id"
WHERE "familyId" IS NULL;

ALTER TABLE "RefreshToken"
    ALTER COLUMN "familyId" SET NOT NULL;

-- CreateTable
CREATE TABLE "LoginAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "emailAttempted" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "event" "LoginAuditEvent" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortName" TEXT,
    "screenscraperId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rom" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "romHash" TEXT,
    "romSize" INTEGER,
    "releaseYear" INTEGER,
    "players" INTEGER,
    "screenscraperId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RomMetadata" (
    "id" TEXT NOT NULL,
    "romId" TEXT NOT NULL,
    "source" "EnrichmentProvider" NOT NULL,
    "language" TEXT,
    "region" TEXT,
    "summary" TEXT,
    "storyline" TEXT,
    "developer" TEXT,
    "publisher" TEXT,
    "genre" TEXT,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RomMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RomAsset" (
    "id" TEXT NOT NULL,
    "romId" TEXT NOT NULL,
    "type" "RomAssetType" NOT NULL,
    "source" "RomAssetSource" NOT NULL,
    "providerId" TEXT,
    "language" TEXT,
    "region" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "format" TEXT,
    "checksum" TEXT,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RomAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RomBinary" (
    "id" TEXT NOT NULL,
    "romId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "archiveMimeType" TEXT,
    "archiveSize" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "checksumSha1" TEXT,
    "checksumMd5" TEXT,
    "checksumCrc32" TEXT,
    "status" "RomBinaryStatus" NOT NULL DEFAULT 'READY',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RomBinary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmulatorBios" (
    "id" TEXT NOT NULL,
    "coreSlug" TEXT NOT NULL,
    "region" TEXT,
    "description" TEXT,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "archiveMimeType" TEXT,
    "archiveSize" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "checksumSha1" TEXT,
    "checksumMd5" TEXT,
    "checksumCrc32" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmulatorBios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RomUploadAudit" (
    "id" TEXT NOT NULL,
    "kind" "RomUploadKind" NOT NULL,
    "status" "RomUploadStatus" NOT NULL,
    "romId" TEXT,
    "romBinaryId" TEXT,
    "biosId" TEXT,
    "platformId" TEXT,
    "uploadedById" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "archiveMimeType" TEXT,
    "archiveSize" INTEGER,
    "checksumSha256" TEXT,
    "checksumSha1" TEXT,
    "checksumMd5" TEXT,
    "checksumCrc32" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RomUploadAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RomEnrichmentJob" (
    "id" TEXT NOT NULL,
    "romId" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "EnrichmentProvider" NOT NULL,
    "providerRomId" TEXT,
    "settings" JSONB NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RomEnrichmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenScraperSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "languagePriority" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regionPriority" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onlyBetterMedia" BOOLEAN NOT NULL DEFAULT false,
    "maxAssetsPerType" INTEGER NOT NULL DEFAULT 3,
    "preferParentGames" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenScraperSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenScraperCacheEntry" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenScraperCacheEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefreshTokenFamily_userId_idx" ON "RefreshTokenFamily"("userId");

-- CreateIndex
CREATE INDEX "LoginAudit_userId_idx" ON "LoginAudit"("userId");

-- CreateIndex
CREATE INDEX "LoginAudit_createdAt_idx" ON "LoginAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_slug_key" ON "Platform"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_screenscraperId_key" ON "Platform"("screenscraperId");

-- CreateIndex
CREATE INDEX "Rom_platformId_idx" ON "Rom"("platformId");

-- CreateIndex
CREATE INDEX "Rom_screenscraperId_idx" ON "Rom"("screenscraperId");

-- CreateIndex
CREATE INDEX "RomMetadata_romId_idx" ON "RomMetadata"("romId");

-- CreateIndex
CREATE UNIQUE INDEX "RomMetadata_romId_source_key" ON "RomMetadata"("romId", "source");

-- CreateIndex
CREATE INDEX "RomAsset_romId_idx" ON "RomAsset"("romId");

-- CreateIndex
CREATE INDEX "RomAsset_type_idx" ON "RomAsset"("type");

-- CreateIndex
CREATE INDEX "RomAsset_providerId_idx" ON "RomAsset"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "RomAsset_romId_providerId_key" ON "RomAsset"("romId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "RomBinary_romId_key" ON "RomBinary"("romId");

-- CreateIndex
CREATE INDEX "EmulatorBios_coreSlug_idx" ON "EmulatorBios"("coreSlug");

-- CreateIndex
CREATE UNIQUE INDEX "EmulatorBios_coreSlug_originalFilename_key" ON "EmulatorBios"("coreSlug", "originalFilename");

-- CreateIndex
CREATE INDEX "RomUploadAudit_romId_idx" ON "RomUploadAudit"("romId");

-- CreateIndex
CREATE INDEX "RomUploadAudit_romBinaryId_idx" ON "RomUploadAudit"("romBinaryId");

-- CreateIndex
CREATE INDEX "RomUploadAudit_biosId_idx" ON "RomUploadAudit"("biosId");

-- CreateIndex
CREATE INDEX "RomUploadAudit_platformId_idx" ON "RomUploadAudit"("platformId");

-- CreateIndex
CREATE INDEX "RomUploadAudit_uploadedById_idx" ON "RomUploadAudit"("uploadedById");

-- CreateIndex
CREATE INDEX "RomEnrichmentJob_romId_idx" ON "RomEnrichmentJob"("romId");

-- CreateIndex
CREATE INDEX "RomEnrichmentJob_status_idx" ON "RomEnrichmentJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenScraperSettings_userId_key" ON "ScreenScraperSettings"("userId");

-- CreateIndex
CREATE INDEX "ScreenScraperSettings_userId_idx" ON "ScreenScraperSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenScraperCacheEntry_cacheKey_key" ON "ScreenScraperCacheEntry"("cacheKey");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- AddForeignKey
ALTER TABLE "RefreshTokenFamily" ADD CONSTRAINT "RefreshTokenFamily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "RefreshTokenFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAudit" ADD CONSTRAINT "LoginAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rom" ADD CONSTRAINT "Rom_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomMetadata" ADD CONSTRAINT "RomMetadata_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomAsset" ADD CONSTRAINT "RomAsset_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomBinary" ADD CONSTRAINT "RomBinary_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomUploadAudit" ADD CONSTRAINT "RomUploadAudit_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomUploadAudit" ADD CONSTRAINT "RomUploadAudit_romBinaryId_fkey" FOREIGN KEY ("romBinaryId") REFERENCES "RomBinary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomUploadAudit" ADD CONSTRAINT "RomUploadAudit_biosId_fkey" FOREIGN KEY ("biosId") REFERENCES "EmulatorBios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomUploadAudit" ADD CONSTRAINT "RomUploadAudit_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomUploadAudit" ADD CONSTRAINT "RomUploadAudit_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomEnrichmentJob" ADD CONSTRAINT "RomEnrichmentJob_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomEnrichmentJob" ADD CONSTRAINT "RomEnrichmentJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenScraperSettings" ADD CONSTRAINT "ScreenScraperSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

