import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import type { Prisma, PrismaClient, ScreenScraperSettings } from "@prisma/client";
import {
  EnrichmentProvider,
  EnrichmentStatus,
  RomAssetSource,
  RomAssetType,
} from "../../utils/prisma-enums.js";
import { ScreenScraperConfig } from "../../config/screenscraper.js";
import { ScreenScraperQueue } from "./queue.js";

const localizedTextSchema = z.object({
  texte: z.string().optional(),
  text: z.string().optional(),
  langue: z.string().optional(),
  language: z.string().optional(),
  region: z.string().optional()
});

const mediaSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  url: z.string().url().optional(),
  format: z.string().optional(),
  region: z.string().optional(),
  langue: z.string().optional(),
  language: z.string().optional(),
  width: z.union([z.number(), z.string()]).optional(),
  height: z.union([z.number(), z.string()]).optional(),
  filesize: z.union([z.number(), z.string()]).optional(),
  md5: z.string().optional(),
  sha1: z.string().optional(),
  crc: z.string().optional()
});

const gameInfoSchema = z.object({
  response: z.object({
    jeu: z.object({
      id: z.string(),
      systemeid: z.string().optional(),
      noms: z
        .object({
          nom: z.union([localizedTextSchema, z.array(localizedTextSchema)]).optional()
        })
        .optional(),
      synopsis: z.union([localizedTextSchema, z.array(localizedTextSchema)]).optional(),
      infos: z
        .record(z.string(), z.unknown())
        .optional()
        .default({}),
      medias: z
        .object({
          media: z.union([mediaSchema, z.array(mediaSchema)]).optional()
        })
        .optional()
    })
  })
});

const gameSearchSchema = z.object({
  response: z.object({
    jeux: z
      .object({
        jeu: z.union([
          z.object({ id: z.string(), nom: z.string().optional(), systemeid: z.string().optional() }),
          z.array(z.object({ id: z.string(), nom: z.string().optional(), systemeid: z.string().optional() }))
        ])
      })
      .optional()
  })
});

const normalizeToArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
};

const coerceString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
};

const uniqueList = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0) {
      continue;
    }

    const lower = normalized.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(lower);
    }
  }

  return result;
};

const mediaTypeMap: Record<string, RomAssetType> = {
  "box-2d": RomAssetType.COVER,
  "box-3d": RomAssetType.COVER,
  "box-texture": RomAssetType.COVER,
  screenshot: RomAssetType.SCREENSHOT,
  titlescreen: RomAssetType.SCREENSHOT,
  wheel: RomAssetType.WHEEL,
  marquee: RomAssetType.MARQUEE,
  video: RomAssetType.VIDEO,
  manuel: RomAssetType.MANUAL,
  flyer: RomAssetType.COVER,
  map: RomAssetType.MAP
};

export type EffectiveScreenScraperSettings = {
  languagePriority: string[];
  regionPriority: string[];
  mediaTypes: string[];
  onlyBetterMedia: boolean;
  maxAssetsPerType: number;
  preferParentGames: boolean;
};

export type ScreenScraperStatus = {
  enabled: boolean;
  diagnostics: ScreenScraperConfig["diagnostics"];
};

type JobWithRom = Prisma.RomEnrichmentJobGetPayload<{
  include: {
    rom: {
      include: {
        platform: true;
        assets: true;
        metadata: true;
      };
    };
  };
}>;

type ScreenScraperMedia = z.infer<typeof mediaSchema>;

type LocalizedText = {
  text: string;
  language?: string;
  region?: string;
};

type EnrichmentJobOptions = {
  romId: string;
  requestedById?: string;
  overrides?: Partial<EffectiveScreenScraperSettings>;
};

type EnrichmentJobMetricStatus = "succeeded" | "failed";

export class ScreenScraperConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScreenScraperConfigurationError";
  }
}

export class ScreenScraperService {
  private readonly prisma: PrismaClient;
  private readonly logger: FastifyBaseLogger;
  private readonly config: ScreenScraperConfig;
  private readonly queue: ScreenScraperQueue;
  private readonly hashedPassword?: string;
  private readonly onJobStatusChange?: (status: EnrichmentJobMetricStatus) => void;
  private readonly onJobDuration?: (
    phase: "queue_wait" | "processing",
    durationSeconds: number,
  ) => void;

  constructor(deps: {
    prisma: PrismaClient;
    logger: FastifyBaseLogger;
    config: ScreenScraperConfig;
    onQueueDepthChange?: (depth: number) => void;
    onJobStatusChange?: (status: EnrichmentJobMetricStatus) => void;
    onJobDuration?: (
      phase: "queue_wait" | "processing",
      durationSeconds: number,
    ) => void;
  }) {
    this.prisma = deps.prisma;
    this.logger = deps.logger;
    this.config = deps.config;
    this.onJobStatusChange = deps.onJobStatusChange;
    this.onJobDuration = deps.onJobDuration;
    this.queue = new ScreenScraperQueue({
      concurrency: this.config.concurrency,
      requestsPerMinute: this.config.requestsPerMinute,
      onQueueDepthChange: deps.onQueueDepthChange,
    });
    this.hashedPassword = this.config.password
      ? createHash("md5").update(this.config.password).digest("hex")
      : undefined;
  }

  isEnabled(): boolean {
    return Boolean(this.config.username && this.hashedPassword && this.config.devId && this.config.devPassword);
  }

  getStatus(): ScreenScraperStatus {
    return {
      enabled: this.isEnabled(),
      diagnostics: this.config.diagnostics
    };
  }

  async getSettings(userId?: string) {
    const defaults: EffectiveScreenScraperSettings = {
      languagePriority: this.config.languagePriority,
      regionPriority: this.config.regionPriority,
      mediaTypes: this.config.mediaTypes,
      onlyBetterMedia: this.config.onlyBetterMedia,
      maxAssetsPerType: this.config.maxAssetsPerType,
      preferParentGames: true
    };

    let userSettings: ScreenScraperSettings | null = null;
    if (userId) {
      userSettings = await this.prisma.screenScraperSettings.findFirst({
        where: { userId }
      });
    }

    const effective = this.mergeSettings(defaults, userSettings ?? undefined, undefined);

    return {
      defaults,
      user: userSettings,
      effective
    };
  }

  async updateUserSettings(
    userId: string,
    input: Partial<EffectiveScreenScraperSettings>
  ): Promise<ScreenScraperSettings> {
    const normalized = this.normalizeSettingsInput(input);

    const payload = {
      languagePriority: normalized.languagePriority ?? this.config.languagePriority,
      regionPriority: normalized.regionPriority ?? this.config.regionPriority,
      mediaTypes: normalized.mediaTypes ?? this.config.mediaTypes,
      onlyBetterMedia: normalized.onlyBetterMedia ?? this.config.onlyBetterMedia,
      maxAssetsPerType: normalized.maxAssetsPerType ?? this.config.maxAssetsPerType,
      preferParentGames: normalized.preferParentGames ?? true
    };

    const record = await this.prisma.screenScraperSettings.upsert({
      where: { userId },
      update: payload,
      create: {
        userId,
        ...payload
      }
    });

    return record;
  }

  async enqueueEnrichmentJob(options: EnrichmentJobOptions): Promise<JobWithRom> {
    if (!this.isEnabled()) {
      throw new ScreenScraperConfigurationError(
        "ScreenScraper credentials are not fully configured. Populate SCREENSCRAPER_* variables before enriching ROMs."
      );
    }

    const { romId, requestedById } = options;

    const rom = await this.prisma.rom.findUnique({
      where: { id: romId },
      include: {
        platform: true,
        assets: true,
        metadata: true
      }
    });

    if (!rom) {
      throw new Error(`ROM with id ${romId} was not found`);
    }

    if (!rom.platform?.screenscraperId) {
      throw new ScreenScraperConfigurationError(
        `Platform ${rom.platform?.name ?? rom.platformId} is missing a ScreenScraper system id`
      );
    }

    const defaults: EffectiveScreenScraperSettings = {
      languagePriority: this.config.languagePriority,
      regionPriority: this.config.regionPriority,
      mediaTypes: this.config.mediaTypes,
      onlyBetterMedia: this.config.onlyBetterMedia,
      maxAssetsPerType: this.config.maxAssetsPerType,
      preferParentGames: true
    };

    let userSettings: ScreenScraperSettings | null = null;
    if (requestedById) {
      userSettings = await this.prisma.screenScraperSettings.findFirst({
        where: { userId: requestedById }
      });
    }

    const effectiveSettings = this.mergeSettings(defaults, userSettings ?? undefined, options.overrides);

    const jobRecord = await this.prisma.romEnrichmentJob.create({
      data: {
        romId,
        requestedById: requestedById ?? null,
        provider: EnrichmentProvider.SCREEN_SCRAPER,
        status: EnrichmentStatus.PENDING,
        settings: JSON.parse(JSON.stringify(effectiveSettings))
      }
    });

    const jobWithRom = await this.prisma.romEnrichmentJob.findUnique({
      where: { id: jobRecord.id },
      include: {
        rom: {
          include: {
            platform: true,
            assets: true,
            metadata: true
          }
        }
      }
    });

    if (!jobWithRom) {
      throw new Error("Failed to load enrichment job after creation");
    }

    void this.processJob(jobWithRom, effectiveSettings).catch((error) => {
      this.logger.error({ jobId: jobWithRom.id, err: error }, "Unhandled ScreenScraper job failure");
    });

    return jobWithRom;
  }

  private normalizeSettingsInput(
    overrides?: Partial<EffectiveScreenScraperSettings>
  ): Partial<EffectiveScreenScraperSettings> {
    if (!overrides) {
      return {};
    }

    const normalized: Partial<EffectiveScreenScraperSettings> = {};

    if (overrides.languagePriority) {
      normalized.languagePriority = uniqueList(overrides.languagePriority);
    }

    if (overrides.regionPriority) {
      normalized.regionPriority = uniqueList(overrides.regionPriority);
    }

    if (overrides.mediaTypes) {
      normalized.mediaTypes = uniqueList(overrides.mediaTypes);
    }

    if (typeof overrides.onlyBetterMedia === "boolean") {
      normalized.onlyBetterMedia = overrides.onlyBetterMedia;
    }

    if (typeof overrides.maxAssetsPerType === "number") {
      normalized.maxAssetsPerType = overrides.maxAssetsPerType;
    }

    if (typeof overrides.preferParentGames === "boolean") {
      normalized.preferParentGames = overrides.preferParentGames;
    }

    return normalized;
  }

  private mergeSettings(
    defaults: EffectiveScreenScraperSettings,
    record?: ScreenScraperSettings,
    overrides?: Partial<EffectiveScreenScraperSettings>
  ): EffectiveScreenScraperSettings {
    const normalizedOverrides = this.normalizeSettingsInput(overrides);

    const languagePriority =
      normalizedOverrides.languagePriority ?? record?.languagePriority ?? defaults.languagePriority;
    const regionPriority =
      normalizedOverrides.regionPriority ?? record?.regionPriority ?? defaults.regionPriority;
    const mediaTypes =
      normalizedOverrides.mediaTypes ?? record?.mediaTypes ?? defaults.mediaTypes;

    return {
      languagePriority: uniqueList(languagePriority),
      regionPriority: uniqueList(regionPriority),
      mediaTypes: uniqueList(mediaTypes),
      onlyBetterMedia: normalizedOverrides.onlyBetterMedia ?? record?.onlyBetterMedia ?? defaults.onlyBetterMedia,
      maxAssetsPerType:
        normalizedOverrides.maxAssetsPerType ?? record?.maxAssetsPerType ?? defaults.maxAssetsPerType,
      preferParentGames:
        normalizedOverrides.preferParentGames ?? record?.preferParentGames ?? defaults.preferParentGames
    };
  }

  private async processJob(job: JobWithRom, settings: EffectiveScreenScraperSettings): Promise<void> {
    const startedAt = new Date();
    await this.prisma.romEnrichmentJob.update({
      where: { id: job.id },
      data: {
        status: EnrichmentStatus.RUNNING,
        startedAt
      }
    });

    if (job.createdAt) {
      const waitSeconds = Math.max(
        0,
        (startedAt.getTime() - job.createdAt.getTime()) / 1000,
      );
      this.onJobDuration?.("queue_wait", waitSeconds);
    }

    try {
      const providerRomId = await this.performEnrichment(job, settings);
      const completedAt = new Date();
      await this.prisma.romEnrichmentJob.update({
        where: { id: job.id },
        data: {
          status: EnrichmentStatus.SUCCEEDED,
          providerRomId,
          completedAt
        }
      });
      const processingSeconds = Math.max(
        0,
        (completedAt.getTime() - startedAt.getTime()) / 1000,
      );
      this.onJobDuration?.("processing", processingSeconds);
      this.onJobStatusChange?.("succeeded");
    } catch (error) {
      const completedAt = new Date();
      await this.prisma.romEnrichmentJob.update({
        where: { id: job.id },
        data: {
          status: EnrichmentStatus.FAILED,
          errorMessage: (error as Error).message,
          completedAt
        }
      });
      const processingSeconds = Math.max(
        0,
        (completedAt.getTime() - startedAt.getTime()) / 1000,
      );
      this.onJobDuration?.("processing", processingSeconds);
      this.onJobStatusChange?.("failed");
      throw error;
    }
  }

  private async performEnrichment(job: JobWithRom, settings: EffectiveScreenScraperSettings): Promise<string> {
    const rom = await this.prisma.rom.findUnique({
      where: { id: job.romId },
      include: {
        platform: true,
        assets: true,
        metadata: true
      }
    });

    if (!rom || !rom.platform) {
      throw new Error(`Unable to load ROM ${job.romId} for enrichment`);
    }

    const platformSystemId = rom.platform.screenscraperId;
    if (!platformSystemId) {
      throw new ScreenScraperConfigurationError(
        `Platform ${rom.platform.name} lacks a ScreenScraper system id`
      );
    }

    const targetGameId = await this.resolveGameId({
      rom,
      platformSystemId,
      preferParentGames: settings.preferParentGames
    });

    const game = await this.fetchGameDetails(targetGameId);

    await this.applyMetadata(rom.id, game, settings);

    return game.id;
  }

  private async resolveGameId(options: {
    rom: Prisma.RomGetPayload<{ include: { platform: true } }>;
    platformSystemId: number;
    preferParentGames: boolean;
  }): Promise<string> {
    const { rom, platformSystemId } = options;

    if (rom.screenscraperId) {
      return String(rom.screenscraperId);
    }

    const response = await this.searchGames(rom.title, platformSystemId);
    if (response.length === 0) {
      throw new Error(`No ScreenScraper match found for ${rom.title}`);
    }

    return response[0].id;
  }

  private async applyMetadata(
    romId: string,
    game: Awaited<ReturnType<typeof this.fetchGameDetails>>,
    settings: EffectiveScreenScraperSettings
  ): Promise<void> {
    const preferredName = this.pickLocalizedText(game.names, settings);
    const preferredSynopsis = this.pickLocalizedText(game.synopsis, settings);

    const releaseYear = game.releaseYear ?? undefined;
    const players = game.players ?? undefined;
    const rating = game.rating ?? undefined;
    const developer = game.developer ?? undefined;
    const publisher = game.publisher ?? undefined;
    const genre = game.genre ?? undefined;

    const existingAssets = await this.prisma.romAsset.findMany({
      where: { romId, source: RomAssetSource.SCREEN_SCRAPER }
    });

    const assetsToPersist = this.selectAssets(game.medias, settings, romId, existingAssets);

    const parsedScreenScraperId = Number.parseInt(game.id, 10);
    if (Number.isNaN(parsedScreenScraperId)) {
      throw new Error(`ScreenScraper returned an invalid game id: ${game.id}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const romUpdateData: Prisma.RomUpdateInput = {
        screenscraperId: parsedScreenScraperId
      };

      const resolvedTitle = preferredName?.text ?? game.defaultName;
      if (resolvedTitle) {
        romUpdateData.title = resolvedTitle;
      }

      if (releaseYear !== undefined) {
        romUpdateData.releaseYear = releaseYear;
      }

      if (players !== undefined) {
        romUpdateData.players = players;
      }

      await tx.rom.update({
        where: { id: romId },
        data: romUpdateData
      });

      await tx.romMetadata.upsert({
        where: { romId_source: { romId, source: EnrichmentProvider.SCREEN_SCRAPER } },
        create: {
          romId,
          source: EnrichmentProvider.SCREEN_SCRAPER,
          language: preferredSynopsis?.language,
          region: preferredSynopsis?.region,
          summary: preferredSynopsis?.text,
          storyline: preferredSynopsis?.text,
          developer,
          publisher,
          genre,
          rating
        },
        update: {
          language: preferredSynopsis?.language,
          region: preferredSynopsis?.region,
          summary: preferredSynopsis?.text,
          storyline: preferredSynopsis?.text,
          developer,
          publisher,
          genre,
          rating
        }
      });

      for (const asset of assetsToPersist) {
        await tx.romAsset.upsert({
          where: {
            romId_providerId: {
              romId,
              providerId: asset.providerId
            }
          },
          create: asset,
          update: {
            externalUrl: asset.externalUrl,
            checksum: asset.checksum,
            fileSize: asset.fileSize,
            width: asset.width,
            height: asset.height,
            format: asset.format,
            language: asset.language,
            region: asset.region
          }
        });
      }
    });
  }

  private pickLocalizedText(
    entries: LocalizedText[],
    settings: EffectiveScreenScraperSettings
  ): LocalizedText | undefined {
    for (const language of settings.languagePriority) {
      const match = entries.find((entry) => entry.language?.toLowerCase() === language.toLowerCase());
      if (match) {
        return match;
      }
    }

    return entries[0];
  }

  private selectAssets(
    medias: ScreenScraperMedia[],
    settings: EffectiveScreenScraperSettings,
    romId: string,
    existingAssets: Array<{
      providerId: string | null;
      type: RomAssetType;
      fileSize: number | null;
      width: number | null;
      height: number | null;
      language: string | null;
      region: string | null;
    }>
  ) {
    const desiredTypes = new Set(settings.mediaTypes.map((type) => type.toLowerCase()));
    const results: Array<Prisma.RomAssetCreateInput & { providerId: string }> = [];
    const countsByType = new Map<RomAssetType, number>();

    for (const asset of existingAssets) {
      countsByType.set(asset.type, (countsByType.get(asset.type) ?? 0) + 1);
    }

    for (const media of medias) {
      const typeKey = media.type.toLowerCase();
      if (!desiredTypes.has(typeKey)) {
        continue;
      }

      const mapped = mediaTypeMap[typeKey];
      if (!mapped) {
        continue;
      }

      const providerId = this.composeProviderId(media);
      const isUpdate = existingAssets.some(
        (asset) => asset.providerId === providerId && asset.type === mapped
      );

      const currentCount = countsByType.get(mapped) ?? 0;
      if (!isUpdate && currentCount >= settings.maxAssetsPerType) {
        continue;
      }
      const language = (coerceString(media.langue) ?? coerceString(media.language))?.toLowerCase();
      const region = coerceString(media.region)?.toLowerCase();

      if (settings.onlyBetterMedia) {
        const existing = existingAssets.find((asset) => {
          const assetLanguage = asset.language?.toLowerCase() ?? undefined;
          const assetRegion = asset.region?.toLowerCase() ?? undefined;
          return (
            asset.type === mapped &&
            assetLanguage === language &&
            assetRegion === region
          );
        });

        const candidateScore = this.assetScore({
          width: coerceNumber(media.width),
          height: coerceNumber(media.height),
          fileSize: coerceNumber(media.filesize)
        });

        if (existing) {
          const existingScore = this.assetScore({
            width: existing.width ?? undefined,
            height: existing.height ?? undefined,
            fileSize: existing.fileSize ?? undefined
          });

          if (existingScore >= candidateScore) {
            continue;
          }
        }
      }

      results.push({
        rom: { connect: { id: romId } },
        type: mapped,
        source: RomAssetSource.SCREEN_SCRAPER,
        providerId,
        externalUrl: media.url,
        format: coerceString(media.format),
        checksum: coerceString(media.sha1) ?? coerceString(media.md5) ?? coerceString(media.crc),
        fileSize: coerceNumber(media.filesize),
        width: coerceNumber(media.width),
        height: coerceNumber(media.height),
        language,
        region
      });

      if (!isUpdate) {
        countsByType.set(mapped, currentCount + 1);
      }
    }

    return results;
  }

  private assetScore(asset: { width?: number; height?: number; fileSize?: number }): number {
    const resolutionScore = (asset.width ?? 0) * (asset.height ?? 0);
    if (resolutionScore > 0) {
      return resolutionScore;
    }

    return asset.fileSize ?? 0;
  }

  private composeProviderId(media: ScreenScraperMedia): string {
    const parts = [
      media.id ?? "media",
      media.type,
      coerceString(media.region) ?? "",
      coerceString(media.langue) ?? coerceString(media.language) ?? ""
    ];

    return parts.join(":");
  }

  private async fetchGameDetails(gameId: string) {
    const response = await this.cachedRequest(`game:${gameId}`, async () => {
      const json = await this.request("jeuInfos.php", { gameid: gameId });
      return gameInfoSchema.parse(json);
    });

    const game = response.response.jeu;

    const names = normalizeToArray(game.noms?.nom).flatMap((entry) => {
      const parsed = localizedTextSchema.safeParse(entry);
      if (!parsed.success) {
        return [];
      }

      const { langue, language, region } = parsed.data;
      const text = parsed.data.texte ?? parsed.data.text;
      if (!text) {
        return [];
      }
      return [
        {
          text,
          language: (langue ?? language)?.toLowerCase(),
          region: region?.toLowerCase()
        }
      ];
    });

    const synopsis = normalizeToArray(game.synopsis).flatMap((entry) => {
      const parsed = localizedTextSchema.safeParse(entry);
      if (!parsed.success) {
        return [];
      }

      const { langue, language, region } = parsed.data;
      const text = parsed.data.texte ?? parsed.data.text;
      if (!text) {
        return [];
      }
      return [
        {
          text,
          language: (langue ?? language)?.toLowerCase(),
          region: region?.toLowerCase()
        }
      ];
    });

    const medias = normalizeToArray(game.medias?.media).flatMap((mediaEntry) => {
      const parsed = mediaSchema.safeParse(mediaEntry);
      if (!parsed.success) {
        return [];
      }

      return [parsed.data];
    });

    const infos = game.infos ?? {};
    const infoRecord = infos as Record<string, unknown>;

    const releaseYear = coerceNumber(infoRecord["annee"]);
    const players = coerceNumber(infoRecord["joueurs"]);
    const rating = coerceNumber(infoRecord["note"]);
    const developer = coerceString(infoRecord["developpeur"]);
    const publisher = coerceString(infoRecord["editeur"]);
    const genre = coerceString(infoRecord["genre"] ?? infoRecord["genres"]);

    const defaultName = names[0]?.text ?? undefined;

    return {
      id: game.id,
      defaultName,
      names,
      synopsis,
      medias,
      releaseYear,
      players,
      rating,
      developer,
      publisher,
      genre
    };
  }

  private async searchGames(title: string, systemId: number) {
    const json = await this.cachedRequest(`search:${systemId}:${title.toLowerCase()}`, async () => {
      const response = await this.request("jeuRecherche.php", {
        recherche: title,
        systemeid: systemId
      });

      return gameSearchSchema.parse(response);
    });

    const games = normalizeToArray(json.response.jeux?.jeu).map((entry) => ({
      id: entry.id,
      name: entry.nom ?? "",
      systemId: entry.systemeid ? Number(entry.systemeid) : undefined
    }));

    return games;
  }

  private async cachedRequest<T>(cacheKey: string, producer: () => Promise<T>): Promise<T> {
    const cached = await this.prisma.screenScraperCacheEntry.findUnique({
      where: { cacheKey }
    });

    if (cached) {
      if (!cached.expiresAt || cached.expiresAt.getTime() > Date.now()) {
        return cached.payload as T;
      }
    }

    const result = await producer();
    const payload = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

    await this.prisma.screenScraperCacheEntry.upsert({
      where: { cacheKey },
      update: {
        payload,
        expiresAt
      },
      create: {
        cacheKey,
        payload,
        expiresAt
      }
    });

    return result;
  }

  private async request(endpoint: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.isEnabled()) {
      throw new ScreenScraperConfigurationError(
        "ScreenScraper credentials missing. Configure SCREENSCRAPER_USERNAME, SCREENSCRAPER_PASSWORD, SCREENSCRAPER_DEV_*"
      );
    }

    const searchParams = new URLSearchParams({
      devid: this.config.devId!,
      devpassword: this.config.devPassword!,
      softname: "treazrisland",
      output: "json",
      ssid: this.config.username!,
      sspassword: this.hashedPassword!
    });

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }

      searchParams.append(key, String(value));
    }

    const url = `${this.config.baseUrl.replace(/\/$/, "")}/${endpoint}?${searchParams.toString()}`;

    return this.queue.enqueue(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "TREAZRISLAND/1.0"
          }
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`ScreenScraper responded with ${response.status}: ${body}`);
        }

        return (await response.json()) as unknown;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          this.logger.warn({ url }, "ScreenScraper request timed out, retrying after backoff");
          await delay(500);
          return this.request(endpoint, params);
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    });
  }
}
