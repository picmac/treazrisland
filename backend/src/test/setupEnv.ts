process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-should-be-32-characters-long!!!";
process.env.STORAGE_BUCKET_ASSETS = process.env.STORAGE_BUCKET_ASSETS ?? "assets";
process.env.STORAGE_BUCKET_ROMS = process.env.STORAGE_BUCKET_ROMS ?? "roms";
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "filesystem";
process.env.STORAGE_LOCAL_ROOT = process.env.STORAGE_LOCAL_ROOT ?? "/tmp/treazrisland";
