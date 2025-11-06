-- Add argon2 digest column for invitations
ALTER TABLE "UserInvitation" ADD COLUMN "tokenDigest" TEXT;
UPDATE "UserInvitation" SET "tokenDigest" = '' WHERE "tokenDigest" IS NULL;
ALTER TABLE "UserInvitation" ALTER COLUMN "tokenDigest" SET NOT NULL;
