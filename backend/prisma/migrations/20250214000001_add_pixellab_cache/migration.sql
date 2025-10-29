-- Add PixelLab cache metadata tables
CREATE TABLE "PixelLabCacheEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cacheKey" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "romId" TEXT,
    "romAssetId" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "missCount" INTEGER NOT NULL DEFAULT 0,
    "lastRequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "PixelLabCacheEntry_cacheKey_key" ON "PixelLabCacheEntry"("cacheKey");
CREATE INDEX "PixelLabCacheEntry_romId_idx" ON "PixelLabCacheEntry"("romId");
CREATE INDEX "PixelLabCacheEntry_styleId_idx" ON "PixelLabCacheEntry"("styleId");
CREATE INDEX "PixelLabCacheEntry_expiresAt_idx" ON "PixelLabCacheEntry"("expiresAt");

ALTER TABLE "PixelLabCacheEntry"
  ADD CONSTRAINT "PixelLabCacheEntry_romId_fkey"
  FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PixelLabCacheEntry"
  ADD CONSTRAINT "PixelLabCacheEntry_romAssetId_fkey"
  FOREIGN KEY ("romAssetId") REFERENCES "RomAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PixelLabRenderLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cacheEntryId" TEXT,
    "romId" TEXT,
    "romAssetId" TEXT,
    "cacheKey" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "cacheHit" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PixelLabRenderLog_cacheEntryId_idx" ON "PixelLabRenderLog"("cacheEntryId");
CREATE INDEX "PixelLabRenderLog_romId_idx" ON "PixelLabRenderLog"("romId");
CREATE INDEX "PixelLabRenderLog_createdAt_idx" ON "PixelLabRenderLog"("createdAt");

ALTER TABLE "PixelLabRenderLog"
  ADD CONSTRAINT "PixelLabRenderLog_cacheEntryId_fkey"
  FOREIGN KEY ("cacheEntryId") REFERENCES "PixelLabCacheEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PixelLabRenderLog"
  ADD CONSTRAINT "PixelLabRenderLog_romId_fkey"
  FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PixelLabRenderLog"
  ADD CONSTRAINT "PixelLabRenderLog_romAssetId_fkey"
  FOREIGN KEY ("romAssetId") REFERENCES "RomAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
