import { createHash, createHmac, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, unlink, copyFile, stat, readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { tmpdir } from "node:os";

type StorageDriver = "filesystem" | "s3";

type CommonStorageConfig = {
  driver: StorageDriver;
  assetBucket: string;
  romBucket: string;
  biosBucket?: string;
  forcePathStyle: boolean;
  signedUrlTTLSeconds?: number;
};

type FilesystemConfig = CommonStorageConfig & {
  driver: "filesystem";
  localRoot: string;
};

type S3Config = CommonStorageConfig & {
  driver: "s3";
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
};

type StorageConfig = FilesystemConfig | S3Config;

export type StorageStreamResult = {
  stream: NodeJS.ReadableStream;
  contentLength?: number;
  contentType?: string;
};

export type StorageSignedUrlResult = {
  url: string;
  expiresAt: Date;
};

export type UploadSource = {
  filePath: string;
  size: number;
  sha256: string;
  sha1?: string;
  md5?: string;
  crc32?: string;
  contentType?: string;
  metadata?: Record<string, string | undefined>;
};

export type AvatarUploadResult = {
  storageKey: string;
  size: number;
  contentType: string;
  checksumSha256: string;
};

export class StorageService {
  constructor(private readonly config: StorageConfig) {}

  get romBucket(): string {
    return this.config.romBucket;
  }

  get biosBucket(): string | undefined {
    return this.config.biosBucket;
  }

  get assetBucket(): string {
    return this.config.assetBucket;
  }

  get signedUrlTTLSeconds(): number | undefined {
    return this.config.signedUrlTTLSeconds;
  }

  prefersSignedUrls(): boolean {
    return this.config.driver === "s3" && typeof this.config.signedUrlTTLSeconds === "number";
  }

  async putRomObject(key: string, source: UploadSource): Promise<void> {
    await this.putObject(this.config.romBucket, key, source);
  }

  async putBiosObject(key: string, source: UploadSource): Promise<void> {
    if (!this.config.biosBucket) {
      throw new Error("BIOS bucket is not configured");
    }
    await this.putObject(this.config.biosBucket, key, source);
  }

  async putObject(bucket: string, key: string, source: UploadSource): Promise<void> {
    if (this.config.driver === "filesystem") {
      await this.putObjectFilesystem(bucket, key, source);
      return;
    }

    await this.putObjectS3(bucket, key, source);
  }

  async getRomObjectStream(key: string): Promise<StorageStreamResult> {
    return this.getObjectStream(this.config.romBucket, key);
  }

  async getAssetObjectStream(key: string): Promise<StorageStreamResult> {
    return this.getObjectStream(this.config.assetBucket, key);
  }

  async getObjectStream(bucket: string, key: string): Promise<StorageStreamResult> {
    if (this.config.driver === "filesystem") {
      return this.getObjectStreamFilesystem(bucket, key);
    }

    return this.getObjectStreamS3(bucket, key);
  }

  async getRomObjectSignedUrl(
    key: string,
    options: { expiresInSeconds?: number } = {}
  ): Promise<StorageSignedUrlResult | null> {
    return this.getObjectSignedUrl(this.config.romBucket, key, options);
  }

  async getAssetObjectSignedUrl(
    key: string,
    options: { expiresInSeconds?: number } = {}
  ): Promise<StorageSignedUrlResult | null> {
    return this.getObjectSignedUrl(this.config.assetBucket, key, options);
  }

  async getObjectSignedUrl(
    bucket: string,
    key: string,
    options: { expiresInSeconds?: number } = {}
  ): Promise<StorageSignedUrlResult | null> {
    if (this.config.driver !== "s3") {
      return null;
    }

    const ttl = options.expiresInSeconds ?? this.config.signedUrlTTLSeconds;
    if (!ttl || ttl <= 0) {
      return null;
    }

    const config = this.config as S3Config;
    const expires = Math.min(ttl, 60 * 60 * 24 * 7); // clamp to 7 days per S3 constraints
    const signedUrl = this.buildS3SignedUrl(config, bucket, key, expires);
    const expiresAt = new Date(Date.now() + expires * 1000);
    return { url: signedUrl.toString(), expiresAt };
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    if (this.config.driver === "filesystem") {
      await this.deleteObjectFilesystem(bucket, key);
      return;
    }

    await this.deleteObjectS3(bucket, key);
  }

  async deleteAssetObject(key: string): Promise<void> {
    await this.deleteObject(this.config.assetBucket, key);
  }

  async deleteRomObject(key: string): Promise<void> {
    await this.deleteObject(this.config.romBucket, key);
  }

  async uploadUserAvatar(
    params: {
      userId: string;
      stream: NodeJS.ReadableStream;
      maxBytes: number;
      contentType?: string | undefined;
    },
  ): Promise<AvatarUploadResult> {
    const { userId, stream, maxBytes, contentType } = params;
    if (!userId) {
      throw new Error("userId is required for avatar uploads");
    }

    const tempPath = join(
      tmpdir(),
      "treazrisland",
      "avatars",
      `${randomUUID()}`,
    );

    await writeStreamToTempFile(stream, tempPath);

    try {
      const fileBuffer = await readFile(tempPath);
      const size = fileBuffer.byteLength;
      if (size === 0) {
        throw new Error("Avatar file is empty");
      }
      if (size > maxBytes) {
        throw new Error(
          `Avatar exceeds maximum size of ${maxBytes} bytes`,
        );
      }

      const detectedMime = detectAvatarMimeType(fileBuffer);
      const providedMime = normalizeMimeType(contentType);
      const mimeType = detectedMime ?? providedMime;

      if (!mimeType || !AVATAR_MIME_TYPE_EXTENSIONS.has(mimeType)) {
        throw new Error("Unsupported avatar format");
      }

      if (providedMime && providedMime !== mimeType) {
        throw new Error("Avatar content-type does not match file signature");
      }

      const sha256 = createHash("sha256").update(fileBuffer).digest("hex");
      const extension = AVATAR_MIME_TYPE_EXTENSIONS.get(mimeType)!;
      const storageKey = `avatars/${userId}/${randomUUID()}.${extension}`;

      await this.putObject(this.config.assetBucket, storageKey, {
        filePath: tempPath,
        size,
        sha256,
        contentType: mimeType,
        metadata: { userId },
      });

      return {
        storageKey,
        size,
        contentType: mimeType,
        checksumSha256: sha256,
      };
    } finally {
      await safeUnlink(tempPath);
    }
  }

  private async putObjectFilesystem(
    bucket: string,
    key: string,
    source: UploadSource
  ): Promise<void> {
    if (this.config.driver !== "filesystem") {
      throw new Error("Filesystem storage is not configured");
    }
    const destPath = normalize(join(this.config.localRoot, bucket, key));
    await mkdir(dirname(destPath), { recursive: true });
    await copyFile(source.filePath, destPath);
  }

  private async getObjectStreamFilesystem(bucket: string, key: string): Promise<StorageStreamResult> {
    if (this.config.driver !== "filesystem") {
      throw new Error("Filesystem storage is not configured");
    }
    const filePath = normalize(join(this.config.localRoot, bucket, key));
    const stream = createReadStream(filePath);
    const stats = await stat(filePath);
    return {
      stream,
      contentLength: stats.size
    };
  }

  private async deleteObjectFilesystem(bucket: string, key: string): Promise<void> {
    if (this.config.driver !== "filesystem") {
      throw new Error("Filesystem storage is not configured");
    }
    const filePath = normalize(join(this.config.localRoot, bucket, key));
    await safeUnlink(filePath);
  }

  private async putObjectS3(bucket: string, key: string, source: UploadSource): Promise<void> {
    if (this.config.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }
    const config = this.config as S3Config;
    const url = this.buildS3Url(config, bucket, key);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = formatDateStamp(now);
    const payloadHash = source.sha256.toLowerCase();

    const headerEntries: Array<[string, string]> = [
      ["host", url.host],
      ["x-amz-content-sha256", payloadHash],
      ["x-amz-date", amzDate],
      ["x-amz-server-side-encryption", "AES256"],
    ];

    if (source.contentType) {
      headerEntries.push(["content-type", source.contentType]);
    }

    const metadataEntries = Object.entries(source.metadata ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        `x-amz-meta-${key.toLowerCase()}`,
        value as string
      ]) as Array<[string, string]>;

    headerEntries.push(...metadataEntries);
    headerEntries.sort(([a], [b]) => a.localeCompare(b));

    const canonicalHeaders = `${headerEntries
      .map(([name, value]) => `${name}:${value.trim()}`)
      .join("\n")}\n`;
    const signedHeaders = headerEntries.map(([name]) => name).join(";");

    const canonicalRequest = [
      "PUT",
      url.pathname,
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join("\n");

    const canonicalHash = createHash("sha256").update(canonicalRequest).digest("hex");
    const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      canonicalHash
    ].join("\n");

    const signingKey = getSigningKey(config.secretKey, dateStamp, config.region, "s3");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = new Headers();
    headers.set("host", url.host);
    headers.set("x-amz-content-sha256", payloadHash);
    headers.set("x-amz-date", amzDate);
    headers.set("x-amz-server-side-encryption", "AES256");
    headers.set("authorization", authorization);
    headers.set("content-length", source.size.toString());

    for (const [name, value] of metadataEntries) {
      headers.set(name, value);
    }

    if (source.contentType) {
      headers.set("content-type", source.contentType);
    }

    const bodyStream = Readable.toWeb(
      createReadStream(source.filePath),
    ) as unknown as globalThis.BodyInit;
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: bodyStream,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `S3 upload failed with status ${response.status}: ${errorBody || response.statusText}`
      );
    }
  }

  private async getObjectStreamS3(bucket: string, key: string): Promise<StorageStreamResult> {
    if (this.config.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }
    const config = this.config as S3Config;
    const response = await this.sendSignedS3Request(config, bucket, key, "GET");
    if (!response.ok || !response.body) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `S3 download failed with status ${response.status}: ${errorBody || response.statusText}`
      );
    }

    const webStream = response.body as WebReadableStream<Uint8Array>;
    const nodeStream = Readable.fromWeb(webStream);
    const contentLengthHeader = response.headers.get("content-length");
    const contentTypeHeader = response.headers.get("content-type") ?? undefined;

    return {
      stream: nodeStream,
      contentLength: contentLengthHeader ? Number(contentLengthHeader) : undefined,
      contentType: contentTypeHeader
    };
  }

  private async deleteObjectS3(bucket: string, key: string): Promise<void> {
    if (this.config.driver !== "s3") {
      throw new Error("S3 storage is not configured");
    }
    const config = this.config as S3Config;
    const response = await this.sendSignedS3Request(config, bucket, key, "DELETE");
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `S3 delete failed with status ${response.status}: ${errorBody || response.statusText}`
      );
    }
  }

  private buildS3Url(config: S3Config, bucket: string, key: string): URL {
    const base = new URL(config.endpoint);
    const encodedKey = encodeS3Key(key);
    if (config.forcePathStyle) {
      base.pathname = `/${bucket}/${encodedKey}`;
    } else {
      base.hostname = `${bucket}.${base.hostname}`;
      base.pathname = `/${encodedKey}`;
    }
    return base;
  }

  private buildS3SignedUrl(
    config: S3Config,
    bucket: string,
    key: string,
    expiresInSeconds: number
  ): URL {
    const url = this.buildS3Url(config, bucket, key);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = formatDateStamp(now);
    const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
    const payloadHash = "UNSIGNED-PAYLOAD";

    const queryEntries: Array<[string, string]> = [
      ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
      ["X-Amz-Credential", `${config.accessKey}/${credentialScope}`],
      ["X-Amz-Date", amzDate],
      ["X-Amz-Expires", `${Math.floor(expiresInSeconds)}`],
      ["X-Amz-SignedHeaders", "host"]
    ];

    queryEntries.sort(([a], [b]) => a.localeCompare(b));

    const canonicalQuery = queryEntries
      .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
      .join("&");

    const canonicalRequest = [
      "GET",
      url.pathname,
      canonicalQuery,
      `host:${url.host}\n`,
      "host",
      payloadHash
    ].join("\n");

    const canonicalHash = createHash("sha256").update(canonicalRequest).digest("hex");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      canonicalHash
    ].join("\n");

    const signingKey = getSigningKey(config.secretKey, dateStamp, config.region, "s3");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    const finalQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`;
    url.search = finalQuery;
    return url;
  }

  private async sendSignedS3Request(
    config: S3Config,
    bucket: string,
    key: string,
    method: "GET" | "DELETE"
  ): Promise<Response> {
    const url = this.buildS3Url(config, bucket, key);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = formatDateStamp(now);
    const payloadHash = "UNSIGNED-PAYLOAD";

    const headerEntries: Array<[string, string]> = [
      ["host", url.host],
      ["x-amz-content-sha256", payloadHash],
      ["x-amz-date", amzDate]
    ];

    headerEntries.sort(([a], [b]) => a.localeCompare(b));

    const canonicalHeaders = `${headerEntries
      .map(([name, value]) => `${name}:${value.trim()}`)
      .join("\n")}\n`;
    const signedHeaders = headerEntries.map(([name]) => name).join(";");

    const canonicalRequest = [
      method,
      url.pathname,
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join("\n");

    const canonicalHash = createHash("sha256").update(canonicalRequest).digest("hex");
    const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      canonicalHash
    ].join("\n");

    const signingKey = getSigningKey(config.secretKey, dateStamp, config.region, "s3");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = new Headers();
    headers.set("host", url.host);
    headers.set("x-amz-content-sha256", payloadHash);
    headers.set("x-amz-date", amzDate);
    headers.set("authorization", authorization);

    return fetch(url, {
      method,
      headers
    });
  }
}

export async function writeStreamToTempFile(
  stream: NodeJS.ReadableStream,
  destinationPath: string
): Promise<void> {
  await mkdir(dirname(destinationPath), { recursive: true });
  const writeStream = createWriteStream(destinationPath);
  await pipeline(stream, writeStream);
}

export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function encodeS3Key(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment).replace(/%2F/gi, "/"))
    .join("/");
}

const AVATAR_MIME_TYPE_EXTENSIONS = new Map<
  string,
  "png" | "jpg" | "webp"
>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

function detectAvatarMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 8) {
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (buffer.subarray(0, 8).equals(pngSignature)) {
      return "image/png";
    }
  }

  if (buffer.length >= 4) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      const hasJpegEnd =
        buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
      if (hasJpegEnd) {
        return "image/jpeg";
      }
    }
  }

  if (buffer.length >= 12) {
    const riffHeader = buffer.toString("ascii", 0, 4);
    const webpHeader = buffer.toString("ascii", 8, 12);
    if (riffHeader === "RIFF" && webpHeader === "WEBP") {
      return "image/webp";
    }
  }

  return null;
}

function normalizeMimeType(contentType?: string): string | null {
  if (!contentType) {
    return null;
  }
  const normalized = contentType.trim().toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
}

function formatAmzDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getUTCDate()}`.padStart(2, "0");
  const hh = `${date.getUTCHours()}`.padStart(2, "0");
  const min = `${date.getUTCMinutes()}`.padStart(2, "0");
  const ss = `${date.getUTCSeconds()}`.padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}

function formatDateStamp(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getUTCDate()}`.padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  return kSigning;
}
