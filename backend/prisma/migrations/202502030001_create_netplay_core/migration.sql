DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NetplaySessionStatus') THEN
        CREATE TYPE "NetplaySessionStatus" AS ENUM ('OPEN', 'ACTIVE', 'CLOSED');
    END IF;
END
$$;

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NetplayParticipantRole') THEN
        CREATE TYPE "NetplayParticipantRole" AS ENUM ('HOST', 'PLAYER');
    END IF;
END
$$;

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NetplayParticipantStatus') THEN
        CREATE TYPE "NetplayParticipantStatus" AS ENUM ('INVITED', 'CONNECTED', 'DISCONNECTED');
    END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "NetplaySession" (
    "id" TEXT NOT NULL,
    "romId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "saveStateId" TEXT,
    "status" "NetplaySessionStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetplaySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetplayParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "NetplayParticipantRole" NOT NULL DEFAULT 'PLAYER',
    "status" "NetplayParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "peerTokenHash" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetplayParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NetplaySession_hostId_idx" ON "NetplaySession"("hostId");

CREATE INDEX IF NOT EXISTS "NetplaySession_status_idx" ON "NetplaySession"("status");

CREATE INDEX IF NOT EXISTS "NetplaySession_expiresAt_idx" ON "NetplaySession"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "NetplayParticipant_sessionId_userId_key" ON "NetplayParticipant"("sessionId", "userId");

CREATE INDEX IF NOT EXISTS "NetplayParticipant_userId_idx" ON "NetplayParticipant"("userId");

CREATE INDEX IF NOT EXISTS "NetplayParticipant_status_idx" ON "NetplayParticipant"("status");

-- Foreign keys to platform, user, and save state tables are added in 20251213090000_add_netplay_foreign_keys.

DO $$
BEGIN
    IF to_regclass('"NetplayParticipant"') IS NULL OR to_regclass('"NetplaySession"') IS NULL THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'NetplayParticipant_sessionId_fkey'
    ) THEN
        ALTER TABLE "NetplayParticipant"
        ADD CONSTRAINT "NetplayParticipant_sessionId_fkey"
        FOREIGN KEY ("sessionId") REFERENCES "NetplaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;

-- privilege-reviewed: 2025-02-28 security hardening checklist automation
