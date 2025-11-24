-- Add avatar metadata and profile audit columns to the User table
ALTER TABLE "User"
  ADD COLUMN "profileUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "profileCompletedAt" TIMESTAMP(3),
  ADD COLUMN "avatarContentType" TEXT,
  ADD COLUMN "avatarSize" INTEGER,
  ADD COLUMN "avatarUploadedAt" TIMESTAMP(3);
