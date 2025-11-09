-- Add avatar metadata to users
ALTER TABLE "User"
  ADD COLUMN "avatarStorageKey" TEXT,
  ADD COLUMN "avatarMimeType" TEXT,
  ADD COLUMN "avatarFileSize" INTEGER,
  ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);
-- privilege-reviewed: 2025-02-28 security hardening checklist automation
