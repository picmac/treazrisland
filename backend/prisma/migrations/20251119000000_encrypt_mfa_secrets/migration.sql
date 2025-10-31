-- Ensure MFA secrets are stored as ciphertext-capable TEXT payloads.
ALTER TABLE "MfaSecret" ALTER COLUMN "secret" SET DATA TYPE TEXT;
ALTER TABLE "MfaSecret" ALTER COLUMN "recoveryCodes" SET DATA TYPE TEXT;
