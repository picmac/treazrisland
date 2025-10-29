-- CreateEnum
CREATE TYPE "NetplaySessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NetplayParticipantRole" AS ENUM ('HOST', 'GUEST');

-- CreateTable
CREATE TABLE "NetplaySession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "romId" TEXT,
    "status" "NetplaySessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "externalSessionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetplaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetplayParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "NetplayParticipantRole" NOT NULL DEFAULT 'GUEST',
    "externalParticipantId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetplayParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetplaySession_code_key" ON "NetplaySession"("code");

-- CreateIndex
CREATE INDEX "NetplaySession_hostUserId_idx" ON "NetplaySession"("hostUserId");

-- CreateIndex
CREATE INDEX "NetplaySession_expiresAt_idx" ON "NetplaySession"("expiresAt");

-- CreateIndex
CREATE INDEX "NetplaySession_status_idx" ON "NetplaySession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NetplayParticipant_sessionId_userId_key" ON "NetplayParticipant"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "NetplayParticipant_sessionId_idx" ON "NetplayParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "NetplayParticipant_userId_idx" ON "NetplayParticipant"("userId");

-- AddForeignKey
ALTER TABLE "NetplaySession" ADD CONSTRAINT "NetplaySession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplaySession" ADD CONSTRAINT "NetplaySession_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplaySession" ADD CONSTRAINT "NetplaySession_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplayParticipant" ADD CONSTRAINT "NetplayParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NetplaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplayParticipant" ADD CONSTRAINT "NetplayParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
