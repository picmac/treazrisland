import fp from "fastify-plugin";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { StorageService } from "../services/storage/storage.js";

export default fp(async (app) => {
  const storageSettings = app.settings.get().storage;
  const driver = storageSettings.driver;
  const common = {
    assetBucket: storageSettings.bucketAssets,
    romBucket: storageSettings.bucketRoms,
    biosBucket: storageSettings.bucketBios,
    forcePathStyle: storageSettings.s3?.forcePathStyle ?? true
  } as const;

  if (driver === "filesystem") {
    const localRoot = storageSettings.localRoot ?? join(process.cwd(), "var", "storage");
    await mkdir(localRoot, { recursive: true });

    const storage = new StorageService({
      ...common,
      driver: "filesystem",
      localRoot,
      signedUrlTTLSeconds: storageSettings.signedUrlTTLSeconds
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

  const s3 = storageSettings.s3;
  if (!s3) {
    throw new Error("S3 storage selected but configuration is missing");
  }

  const { endpoint, region, accessKey, secretKey, forcePathStyle } = s3;
  if (!endpoint || !region || !accessKey || !secretKey) {
    throw new Error("S3 storage configuration is incomplete");
  }

  const storage = new StorageService({
    ...common,
    driver: "s3",
    endpoint,
    region,
    accessKey,
    secretKey,
    forcePathStyle: forcePathStyle ?? true,
    signedUrlTTLSeconds: storageSettings.signedUrlTTLSeconds
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
