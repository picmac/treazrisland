import fp from "fastify-plugin";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../config/env.js";
import { StorageService } from "../services/storage/storage.js";

export default fp(async (app) => {
  const driver = env.STORAGE_DRIVER;
  const common = {
    assetBucket: env.STORAGE_BUCKET_ASSETS,
    romBucket: env.STORAGE_BUCKET_ROMS,
    biosBucket: env.STORAGE_BUCKET_BIOS,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE
  } as const;

  if (driver === "filesystem") {
    const localRoot = env.STORAGE_LOCAL_ROOT ?? join(process.cwd(), "var", "storage");
    await mkdir(localRoot, { recursive: true });

    const storage = new StorageService({
      ...common,
      driver: "filesystem",
      localRoot,
      signedUrlTTLSeconds: env.STORAGE_SIGNED_URL_TTL_SECONDS
    });

    if (app.hasDecorator("storage")) {
      app.log.warn(
        "storage decorator already registered, overriding existing instance",
      );
      (app as { storage: StorageService }).storage = storage;
      return;
    }
    app.decorate("storage", storage);
    return;
  }

  const storage = new StorageService({
    ...common,
    driver: "s3",
    endpoint: env.STORAGE_ENDPOINT!,
    region: env.STORAGE_REGION!,
    accessKey: env.STORAGE_ACCESS_KEY!,
    secretKey: env.STORAGE_SECRET_KEY!,
    signedUrlTTLSeconds: env.STORAGE_SIGNED_URL_TTL_SECONDS
  });

  if (app.hasDecorator("storage")) {
    app.log.warn(
      "storage decorator already registered, overriding existing instance",
    );
    (app as { storage: StorageService }).storage = storage;
    return;
  }
  app.decorate("storage", storage);
});
