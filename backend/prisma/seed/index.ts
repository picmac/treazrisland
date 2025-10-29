import type {
  NetplayParticipantRole,
  NetplaySessionStatus,
  Role,
} from "@prisma/client";

export interface SeedUser {
  id: string;
  email: string;
  nickname: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeedPlatform {
  id: string;
  name: string;
  slug: string;
  shortName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeedRom {
  id: string;
  platformId: string;
  title: string;
  romHash?: string;
  romSize?: number;
  releaseYear?: number;
  players?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeedNetplaySession {
  id: string;
  hostId: string;
  romId?: string;
  status: NetplaySessionStatus;
  joinCode: string;
  externalSessionId?: string;
  expiresAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeedNetplayParticipant {
  id: string;
  sessionId: string;
  userId: string;
  romId?: string;
  role: NetplayParticipantRole;
  externalParticipantId?: string;
  joinedAt: Date;
  leftAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const baseTime = new Date("2024-01-05T20:00:00.000Z");
const minutesFromBase = (minutes: number) =>
  new Date(baseTime.getTime() + minutes * 60 * 1000);

export const seedUsers: SeedUser[] = [
  {
    id: "user-host",
    email: "elaine@treazrisland.test",
    nickname: "hostpirate",
    displayName: "Elaine Marley",
    passwordHash: "argon2id$demo$host",
    role: "USER",
    createdAt: minutesFromBase(0),
    updatedAt: minutesFromBase(0),
  },
  {
    id: "user-guest",
    email: "guybrush@treazrisland.test",
    nickname: "brush",
    displayName: "Guybrush Threepwood",
    passwordHash: "argon2id$demo$guest",
    role: "USER",
    createdAt: minutesFromBase(1),
    updatedAt: minutesFromBase(1),
  },
];

export const seedPlatforms: SeedPlatform[] = [
  {
    id: "platform-snes",
    name: "Super Nintendo Entertainment System",
    slug: "snes",
    shortName: "SNES",
    createdAt: minutesFromBase(0),
    updatedAt: minutesFromBase(0),
  },
];

export const seedRoms: SeedRom[] = [
  {
    id: "rom-chrono",
    platformId: "platform-snes",
    title: "Chrono Trigger",
    romHash: "dummy-hash-chrono",
    romSize: 4194304,
    releaseYear: 1995,
    players: 2,
    createdAt: minutesFromBase(2),
    updatedAt: minutesFromBase(2),
  },
  {
    id: "rom-secret",
    platformId: "platform-snes",
    title: "Secret of Mana",
    romHash: "dummy-hash-mana",
    romSize: 3145728,
    releaseYear: 1993,
    players: 3,
    createdAt: minutesFromBase(3),
    updatedAt: minutesFromBase(3),
  },
];

export const seedNetplaySessions: SeedNetplaySession[] = [
  {
    id: "netplay-session-active",
    hostId: "user-host",
    romId: "rom-chrono",
    status: "ACTIVE",
    joinCode: "SEABELL",
    externalSessionId: "dummy-session-active",
    expiresAt: minutesFromBase(180),
    startedAt: minutesFromBase(10),
    createdAt: minutesFromBase(5),
    updatedAt: minutesFromBase(70),
  },
  {
    id: "netplay-session-ended",
    hostId: "user-host",
    romId: "rom-secret",
    status: "ENDED",
    joinCode: "REEFEND",
    externalSessionId: "dummy-session-ended",
    expiresAt: minutesFromBase(240),
    startedAt: minutesFromBase(20),
    endedAt: minutesFromBase(180),
    createdAt: minutesFromBase(15),
    updatedAt: minutesFromBase(180),
  },
];

export const seedNetplayParticipants: SeedNetplayParticipant[] = [
  {
    id: "participant-host-active",
    sessionId: "netplay-session-active",
    userId: "user-host",
    romId: "rom-chrono",
    role: "HOST",
    externalParticipantId: "dummy-host-active",
    joinedAt: minutesFromBase(10),
    createdAt: minutesFromBase(10),
    updatedAt: minutesFromBase(70),
  },
  {
    id: "participant-guest-active",
    sessionId: "netplay-session-active",
    userId: "user-guest",
    romId: "rom-chrono",
    role: "GUEST",
    externalParticipantId: "dummy-guest-active",
    joinedAt: minutesFromBase(12),
    createdAt: minutesFromBase(12),
    updatedAt: minutesFromBase(65),
  },
  {
    id: "participant-host-ended",
    sessionId: "netplay-session-ended",
    userId: "user-host",
    romId: "rom-secret",
    role: "HOST",
    externalParticipantId: "dummy-host-ended",
    joinedAt: minutesFromBase(20),
    leftAt: minutesFromBase(180),
    createdAt: minutesFromBase(20),
    updatedAt: minutesFromBase(180),
  },
];

export const seedData = {
  users: seedUsers,
  platforms: seedPlatforms,
  roms: seedRoms,
  netplaySessions: seedNetplaySessions,
  netplayParticipants: seedNetplayParticipants,
};

export type SeedData = typeof seedData;
