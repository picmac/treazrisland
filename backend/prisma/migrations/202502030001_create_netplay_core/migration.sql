-- CreateEnum
CREATE TYPE "NetplaySessionStatus" AS ENUM ('OPEN', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "NetplayParticipantRole" AS ENUM ('HOST', 'PLAYER');

-- CreateEnum
CREATE TYPE "NetplayParticipantStatus" AS ENUM ('INVITED', 'CONNECTED', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "NetplaySession" (
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

-- CreateTable
CREATE TABLE "NetplayParticipant" (
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

-- CreateIndex
CREATE INDEX "NetplaySession_hostId_idx" ON "NetplaySession"("hostId");

-- CreateIndex
CREATE INDEX "NetplaySession_status_idx" ON "NetplaySession"("status");

-- CreateIndex
CREATE INDEX "NetplaySession_expiresAt_idx" ON "NetplaySession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NetplayParticipant_sessionId_userId_key" ON "NetplayParticipant"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "NetplayParticipant_userId_idx" ON "NetplayParticipant"("userId");

-- CreateIndex
CREATE INDEX "NetplayParticipant_status_idx" ON "NetplayParticipant"("status");

-- AddForeignKey
ALTER TABLE "NetplaySession" ADD CONSTRAINT "NetplaySession_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplaySession" ADD CONSTRAINT "NetplaySession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplaySession" ADD CONSTRAINT "NetplaySession_saveStateId_fkey" FOREIGN KEY ("saveStateId") REFERENCES "PlayState"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplayParticipant" ADD CONSTRAINT "NetplayParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NetplaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplayParticipant" ADD CONSTRAINT "NetplayParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- privilege-reviewed: 2025-02-28 security hardening checklist automation
