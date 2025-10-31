process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-should-be-32-characters-long!!!";
process.env.MFA_ENCRYPTION_KEY =
  process.env.MFA_ENCRYPTION_KEY ?? "test-mfa-encryption-key-should-be-long";
process.env.STORAGE_BUCKET_ASSETS = process.env.STORAGE_BUCKET_ASSETS ?? "assets";
process.env.STORAGE_BUCKET_ROMS = process.env.STORAGE_BUCKET_ROMS ?? "roms";
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "filesystem";
process.env.STORAGE_LOCAL_ROOT = process.env.STORAGE_LOCAL_ROOT ?? "/tmp/treazrisland";
process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER ?? "postmark";
process.env.POSTMARK_SERVER_TOKEN =
  process.env.POSTMARK_SERVER_TOKEN ?? "test-postmark-token";
process.env.POSTMARK_FROM_EMAIL =
  process.env.POSTMARK_FROM_EMAIL ?? "no-reply@example.com";
process.env.POSTMARK_MESSAGE_STREAM =
  process.env.POSTMARK_MESSAGE_STREAM ?? "outbound";
