import { randomUUID } from 'node:crypto';

import type { SaveState } from '@prisma/client';

export type SaveStateRecord = SaveState;

export type CreateSaveStateInput = Omit<SaveStateRecord, 'id' | 'createdAt' | 'updatedAt'>;

export class SaveStateService {
  private readonly statesByUserAndRom = new Map<string, SaveStateRecord[]>();

  create(input: CreateSaveStateInput): SaveStateRecord {
    const id = randomUUID();
    const now = new Date();
    const record: SaveStateRecord = {
      id,
      ...input,
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
