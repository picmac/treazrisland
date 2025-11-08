process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-should-be-32-characters-long!!!";
process.env.MFA_ENCRYPTION_KEY =
  process.env.MFA_ENCRYPTION_KEY ?? "test-mfa-encryption-key-should-be-long";
process.env.STORAGE_BUCKET_ASSETS = process.env.STORAGE_BUCKET_ASSETS ?? "assets";
process.env.STORAGE_BUCKET_ROMS = process.env.STORAGE_BUCKET_ROMS ?? "roms";
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "filesystem";
process.env.STORAGE_LOCAL_ROOT = process.env.STORAGE_LOCAL_ROOT ?? "/tmp/treazrisland";
process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER ?? "smtp";
process.env.SMTP_HOST = process.env.SMTP_HOST ?? "localhost";
process.env.SMTP_PORT = process.env.SMTP_PORT ?? "1025";
process.env.SMTP_SECURE = process.env.SMTP_SECURE ?? "none";
process.env.SMTP_FROM_EMAIL =
  process.env.SMTP_FROM_EMAIL ?? "no-reply@example.com";
process.env.SMTP_FROM_NAME =
  process.env.SMTP_FROM_NAME ?? "TREAZRISLAND";
