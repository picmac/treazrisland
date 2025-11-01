import type { PrismaClient, Prisma } from "@prisma/client";

export interface SystemSettingRecord {
  key: string;
  value: unknown;
  updatedById: string | null;
}

export interface SystemSettingDelegate {
  findMany(): Promise<SystemSettingRecord[]>;
  upsert(args: {
    where: { key: string };
    create: { key: string; value: unknown; updatedById?: string | null };
    update: { value: unknown; updatedById?: string | null };
  }): Promise<SystemSettingRecord>;
}

export interface SetupStateRecord {
  id: number;
  setupComplete: boolean;
  steps: Prisma.JsonValue | null;
}

export interface SetupStateDelegate {
  findUnique(args: { where: { id: number } }): Promise<SetupStateRecord | null>;
  create(args: {
    data: { id: number; setupComplete: boolean; steps: Prisma.JsonValue };
  }): Promise<SetupStateRecord>;
  upsert(args: {
    where: { id: number };
    create: { id: number; setupComplete: boolean; steps: Prisma.JsonValue };
    update: { setupComplete?: boolean; steps?: Prisma.JsonValue };
  }): Promise<SetupStateRecord>;
}

export type ExtendedPrismaClient = PrismaClient & {
  systemSetting: SystemSettingDelegate;
  setupState: SetupStateDelegate;
};
