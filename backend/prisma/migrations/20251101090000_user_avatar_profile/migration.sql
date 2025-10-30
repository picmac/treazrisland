-- Add avatar metadata to users
ALTER TABLE "User"
  ADD COLUMN "avatarStorageKey" TEXT,
  ADD COLUMN "avatarMimeType" TEXT,
  ADD COLUMN "avatarFileSize" INTEGER,
  ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);
