process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '3000';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-value-123456789012345';
process.env.JWT_ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL ?? '60';
process.env.JWT_REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL ?? '300';
process.env.MAGIC_LINK_TOKEN_TTL = process.env.MAGIC_LINK_TOKEN_TTL ?? '120';
