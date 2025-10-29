import { createHash, createHmac } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, unlink, copyFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { pipeline } from "node:stream/promises";

type StorageDriver = "filesystem" | "s3";

type CommonStorageConfig = {
  driver: StorageDriver;
  assetBucket: string;
  romBucket: string;
  biosBucket?: string;
  forcePathStyle: boolean;
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

export class StorageService {
  constructor(private readonly config: StorageConfig) {}

  get romBucket(): string {
    return this.config.romBucket;
  }

  get biosBucket(): string | undefined {
    return this.config.biosBucket;
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
      ["x-amz-date", amzDate]
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
    headers.set("authorization", authorization);
    headers.set("content-length", source.size.toString());

    for (const [name, value] of metadataEntries) {
      headers.set(name, value);
    }

    if (source.contentType) {
      headers.set("content-type", source.contentType);
    }

    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: createReadStream(source.filePath)
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `S3 upload failed with status ${response.status}: ${errorBody || response.statusText}`
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
