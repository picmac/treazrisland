import { createHash } from 'node:crypto';

import type { RomStorage } from './storage';
import type { PrismaClient, SaveState } from '@prisma/client';

export type SaveStateRecord = SaveState;

export interface SaveStateBinaryInput {
  filename?: string;
  contentType: string;
  data: Buffer;
}

export interface SaveStateMetadataInput {
  objectKey: string;
  checksum: string;
  contentType: string;
  size: number;
}

export interface CreateSaveStateInput {
  userId: string;
  romId: string;
  slot: number;
  label?: string | null;
  binary?: SaveStateBinaryInput;
  metadata?: SaveStateMetadataInput;
}

export interface GetSaveStateOptions {
  includeData?: boolean;
}

export type SaveStateWithData = { saveState: SaveStateRecord; data?: Buffer };

export class SaveStateService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: RomStorage,
  ) {}

  async create(input: CreateSaveStateInput): Promise<SaveStateRecord> {
    const metadata = input.binary ? await this.uploadBinary(input) : input.metadata;

    if (!metadata) {
      throw new Error('Save state metadata is required');
    }

    return this.prisma.saveState.upsert({
      where: { userId_romId_slot: { userId: input.userId, romId: input.romId, slot: input.slot } },
      update: {
        label: input.label ?? null,
        objectKey: metadata.objectKey,
        checksum: metadata.checksum,
        contentType: metadata.contentType,
        size: metadata.size,
      },
      create: {
        userId: input.userId,
        romId: input.romId,
        slot: input.slot,
        label: input.label ?? null,
        objectKey: metadata.objectKey,
        checksum: metadata.checksum,
        contentType: metadata.contentType,
        size: metadata.size,
      },
    });
  }

  async getById(
    userId: string,
    romId: string,
    saveStateId: string,
    options?: GetSaveStateOptions,
  ): Promise<SaveStateWithData | undefined> {
    const saveState = await this.prisma.saveState.findFirst({
      where: { id: saveStateId, userId, romId },
    });

    if (!saveState) {
      return undefined;
    }

    if (!options?.includeData) {
      return { saveState };
    }

    const data = await this.storage.downloadAsset(saveState.objectKey);

    return { saveState, data };
  }

  private async uploadBinary(input: CreateSaveStateInput): Promise<SaveStateMetadataInput> {
    if (!input.binary) {
      throw new Error('Binary payload missing for save state upload');
    }

    const checksum = createHash('sha256').update(input.binary.data).digest('hex');

    const upload = await this.storage.uploadAsset({
      filename: input.binary.filename ?? `save-state-slot-${input.slot}.bin`,
      contentType: input.binary.contentType,
      data: input.binary.data.toString('base64'),
      checksum,
      directory: `save-states/${input.userId}/${input.romId}`,
    });

    return {
      objectKey: upload.objectKey,
      checksum: upload.checksum,
      contentType: upload.contentType,
      size: upload.size,
    };
  }
}
