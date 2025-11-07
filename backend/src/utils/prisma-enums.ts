import * as prismaModule from "@prisma/client";

type FallbackEnums = {
  Role: { ADMIN: "ADMIN"; USER: "USER" };
  EnrichmentProvider: { SCREEN_SCRAPER: "SCREEN_SCRAPER"; MANUAL: "MANUAL" };
  EnrichmentStatus: {
    PENDING: "PENDING";
    RUNNING: "RUNNING";
    SUCCEEDED: "SUCCEEDED";
    FAILED: "FAILED";
  };
  RomAssetSource: {
    SCREEN_SCRAPER: "SCREEN_SCRAPER";
    USER_UPLOAD: "USER_UPLOAD";
    MANUAL_ENTRY: "MANUAL_ENTRY";
  };
  RomAssetType: {
    COVER: "COVER";
    LOGO: "LOGO";
    SCREENSHOT: "SCREENSHOT";
    VIDEO: "VIDEO";
    MANUAL: "MANUAL";
    WHEEL: "WHEEL";
    MARQUEE: "MARQUEE";
    MAP: "MAP";
    OTHER: "OTHER";
  };
  RomBinaryStatus: {
    PENDING: "PENDING";
    READY: "READY";
    FAILED: "FAILED";
  };
  RomUploadStatus: {
    PROCESSING: "PROCESSING";
    SUCCEEDED: "SUCCEEDED";
    FAILED: "FAILED";
  };
  LoginAuditEvent: {
    SUCCESS: "SUCCESS";
    FAILURE: "FAILURE";
    MFA_REQUIRED: "MFA_REQUIRED";
    LOGOUT: "LOGOUT";
    PASSWORD_RESET: "PASSWORD_RESET";
  };
  CreativeAssetKind: {
    HERO: "HERO";
    BACKGROUND: "BACKGROUND";
    BANNER: "BANNER";
  };
  CreativeAssetStatus: {
    ACTIVE: "ACTIVE";
    ARCHIVED: "ARCHIVED";
  };
  CreativeAssetUsageKind: {
    LIBRARY_HERO: "LIBRARY_HERO";
    PLATFORM_HERO: "PLATFORM_HERO";
  };
  CreativeAssetAuditAction: {
    CREATE_ASSET: "CREATE_ASSET";
    UPDATE_ASSET: "UPDATE_ASSET";
    DELETE_ASSET: "DELETE_ASSET";
    ASSIGN_USAGE: "ASSIGN_USAGE";
    REMOVE_USAGE: "REMOVE_USAGE";
  };
  CreativeAssetAuditStatus: {
    SUCCEEDED: "SUCCEEDED";
    FAILED: "FAILED";
  };
};

const fallbackEnums: FallbackEnums = {
  Role: { ADMIN: "ADMIN", USER: "USER" },
  EnrichmentProvider: { SCREEN_SCRAPER: "SCREEN_SCRAPER", MANUAL: "MANUAL" },
  EnrichmentStatus: {
    PENDING: "PENDING",
    RUNNING: "RUNNING",
    SUCCEEDED: "SUCCEEDED",
    FAILED: "FAILED",
  },
  RomAssetSource: {
    SCREEN_SCRAPER: "SCREEN_SCRAPER",
    USER_UPLOAD: "USER_UPLOAD",
    MANUAL_ENTRY: "MANUAL_ENTRY",
  },
  RomAssetType: {
    COVER: "COVER",
    LOGO: "LOGO",
    SCREENSHOT: "SCREENSHOT",
    VIDEO: "VIDEO",
    MANUAL: "MANUAL",
    WHEEL: "WHEEL",
    MARQUEE: "MARQUEE",
    MAP: "MAP",
    OTHER: "OTHER",
  },
  RomBinaryStatus: {
    PENDING: "PENDING",
    READY: "READY",
    FAILED: "FAILED",
  },
  RomUploadStatus: {
    PROCESSING: "PROCESSING",
    SUCCEEDED: "SUCCEEDED",
    FAILED: "FAILED",
  },
  LoginAuditEvent: {
    SUCCESS: "SUCCESS",
    FAILURE: "FAILURE",
    MFA_REQUIRED: "MFA_REQUIRED",
    LOGOUT: "LOGOUT",
    PASSWORD_RESET: "PASSWORD_RESET",
  },
  CreativeAssetKind: {
    HERO: "HERO",
    BACKGROUND: "BACKGROUND",
    BANNER: "BANNER",
  },
  CreativeAssetStatus: {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
  },
  CreativeAssetUsageKind: {
    LIBRARY_HERO: "LIBRARY_HERO",
    PLATFORM_HERO: "PLATFORM_HERO",
  },
  CreativeAssetAuditAction: {
    CREATE_ASSET: "CREATE_ASSET",
    UPDATE_ASSET: "UPDATE_ASSET",
    DELETE_ASSET: "DELETE_ASSET",
    ASSIGN_USAGE: "ASSIGN_USAGE",
    REMOVE_USAGE: "REMOVE_USAGE",
  },
  CreativeAssetAuditStatus: {
    SUCCEEDED: "SUCCEEDED",
    FAILED: "FAILED",
  },
};

type EnumKey = keyof FallbackEnums;

const getEnum = <K extends EnumKey>(key: K): FallbackEnums[K] => {
  const moduleDefault = (prismaModule as { default?: unknown }).default;
  const modulePrisma = (prismaModule as { Prisma?: unknown }).Prisma;
  const defaultPrisma = (moduleDefault as { Prisma?: unknown })?.Prisma;

  const candidates: unknown[] = [
    prismaModule,
    moduleDefault,
    modulePrisma,
    defaultPrisma,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const container = candidate as {
      $Enums?: Partial<Record<EnumKey, unknown>>;
    } & Record<string, unknown>;

    const fromEnums = container.$Enums?.[key] as
      | FallbackEnums[K]
      | undefined;
    if (fromEnums) {
      return fromEnums;
    }

    const fromModule = container[key] as FallbackEnums[K] | undefined;
    if (fromModule) {
      return fromModule;
    }
  }

  return fallbackEnums[key];
};

export const Role = getEnum("Role");
export const EnrichmentProvider = getEnum("EnrichmentProvider");
export const EnrichmentStatus = getEnum("EnrichmentStatus");
export const RomAssetSource = getEnum("RomAssetSource");
export const RomAssetType = getEnum("RomAssetType");
export const RomBinaryStatus = getEnum("RomBinaryStatus");
export const RomUploadStatus = getEnum("RomUploadStatus");
export const LoginAuditEvent = getEnum("LoginAuditEvent");
export const CreativeAssetKind = getEnum("CreativeAssetKind");
export const CreativeAssetStatus = getEnum("CreativeAssetStatus");
export const CreativeAssetUsageKind = getEnum("CreativeAssetUsageKind");
export const CreativeAssetAuditAction = getEnum("CreativeAssetAuditAction");
export const CreativeAssetAuditStatus = getEnum("CreativeAssetAuditStatus");
