import { randomUUID } from 'node:crypto';

export interface SaveStateRecord {
  id: string;
  userId: string;
  romId: string;
  slot: number;
  label?: string;
  objectKey: string;
  checksum: string;
  size: number;
  contentType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSaveStateInput {
  userId: string;
  romId: string;
  slot: number;
  label?: string;
  objectKey: string;
  checksum: string;
  size: number;
  contentType: string;
}

export class SaveStateService {
  private readonly statesByUserAndRom = new Map<string, SaveStateRecord[]>();

  create(input: CreateSaveStateInput): SaveStateRecord {
    const id = randomUUID();
    const now = new Date();
    const record: SaveStateRecord = {
      id,
      userId: input.userId,
      romId: input.romId,
      slot: input.slot,
      label: input.label,
      objectKey: input.objectKey,
      checksum: input.checksum,
      size: input.size,
      contentType: input.contentType,
      createdAt: now,
      updatedAt: now,
    };

    const key = this.getMapKey(input.userId, input.romId);
    const existing = this.statesByUserAndRom.get(key) ?? [];
    const filtered = existing.filter((state) => state.slot !== input.slot);
    this.statesByUserAndRom.set(key, [...filtered, record]);

    return record;
  }

  getLatest(userId: string, romId: string): SaveStateRecord | undefined {
    const key = this.getMapKey(userId, romId);
    const states = this.statesByUserAndRom.get(key);

    if (!states || states.length === 0) {
      return undefined;
    }

    return states.reduce((latest, current) =>
      current.updatedAt.getTime() > latest.updatedAt.getTime() ? current : latest,
    );
  }

  private getMapKey(userId: string, romId: string): string {
    return `${userId}:${romId}`;
  }
}
