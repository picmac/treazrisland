-- CreateTable
CREATE TABLE "NetplaySignalMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderTokenHash" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientTokenHash" TEXT,
    "messageType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetplaySignalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetplaySignalMessage_sessionId_createdAt_idx" ON "NetplaySignalMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "NetplaySignalMessage_senderId_idx" ON "NetplaySignalMessage"("senderId");

-- CreateIndex
CREATE INDEX "NetplaySignalMessage_recipientId_idx" ON "NetplaySignalMessage"("recipientId");

-- AddForeignKey
ALTER TABLE "NetplaySignalMessage" ADD CONSTRAINT "NetplaySignalMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NetplaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplaySignalMessage" ADD CONSTRAINT "NetplaySignalMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "NetplayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetplaySignalMessage" ADD CONSTRAINT "NetplaySignalMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "NetplayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- privilege-reviewed: 2025-02-28 security hardening checklist automation
