process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '3000';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-value-123456789012345';
process.env.JWT_ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL ?? '60';
process.env.JWT_REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL ?? '300';
process.env.MAGIC_LINK_TOKEN_TTL = process.env.MAGIC_LINK_TOKEN_TTL ?? '120';
process.env.MAGIC_LINK_VERIFY_USERS = process.env.MAGIC_LINK_VERIFY_USERS ?? 'true';
process.env.OBJECT_STORAGE_ENDPOINT = process.env.OBJECT_STORAGE_ENDPOINT ?? '127.0.0.1';
process.env.OBJECT_STORAGE_PORT = process.env.OBJECT_STORAGE_PORT ?? '9000';
process.env.OBJECT_STORAGE_USE_SSL = process.env.OBJECT_STORAGE_USE_SSL ?? 'false';
process.env.OBJECT_STORAGE_ACCESS_KEY = process.env.OBJECT_STORAGE_ACCESS_KEY ?? 'minioadmin';
process.env.OBJECT_STORAGE_SECRET_KEY = process.env.OBJECT_STORAGE_SECRET_KEY ?? 'minioadmin';
process.env.OBJECT_STORAGE_BUCKET = process.env.OBJECT_STORAGE_BUCKET ?? 'roms';
process.env.OBJECT_STORAGE_REGION = process.env.OBJECT_STORAGE_REGION ?? 'us-east-1';
process.env.OBJECT_STORAGE_PRESIGNED_TTL = process.env.OBJECT_STORAGE_PRESIGNED_TTL ?? '60';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/treazrisland';
