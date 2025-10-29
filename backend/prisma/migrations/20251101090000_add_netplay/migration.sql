-- Migration: add_netplay
-- Notes: Introduce netplay session/participant models and supporting enums for multiplayer coordination.

-- CreateEnum
CREATE TYPE "NetplaySessionStatus" AS ENUM ('LOBBY', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NetplayParticipantRole" AS ENUM ('HOST', 'PLAYER', 'SPECTATOR');

-- CreateTable
CREATE TABLE "NetplaySession" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "romId" TEXT,
    "joinCode" TEXT NOT NULL,
    "status" "NetplaySessionStatus" NOT NULL DEFAULT 'LOBBY',
    "expiresAt" TIMESTAMP(3),
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
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetplayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetplaySession_joinCode_key" ON "NetplaySession"("joinCode");

-- CreateIndex
CREATE INDEX "NetplaySession_status_expiresAt_idx" ON "NetplaySession"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NetplayParticipant_sessionId_userId_key" ON "NetplayParticipant"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "NetplayParticipant_sessionId_idx" ON "NetplayParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "NetplayParticipant_userId_idx" ON "NetplayParticipant"("userId");

-- AddForeignKey
ALTER TABLE "NetplaySession" ADD CONSTRAINT "NetplaySession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplaySession" ADD CONSTRAINT "NetplaySession_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplayParticipant" ADD CONSTRAINT "NetplayParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NetplaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplayParticipant" ADD CONSTRAINT "NetplayParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
