-- CreateTable
CREATE TABLE IF NOT EXISTS "NetplaySignalMessage" (
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
CREATE INDEX IF NOT EXISTS "NetplaySignalMessage_sessionId_createdAt_idx" ON "NetplaySignalMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NetplaySignalMessage_senderId_idx" ON "NetplaySignalMessage"("senderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NetplaySignalMessage_recipientId_idx" ON "NetplaySignalMessage"("recipientId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetplaySignalMessage_sessionId_fkey'
  ) THEN
    ALTER TABLE "NetplaySignalMessage"
      ADD CONSTRAINT "NetplaySignalMessage_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "NetplaySession"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetplaySignalMessage_senderId_fkey'
  ) THEN
    ALTER TABLE "NetplaySignalMessage"
      ADD CONSTRAINT "NetplaySignalMessage_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "NetplayParticipant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetplaySignalMessage_recipientId_fkey'
  ) THEN
    ALTER TABLE "NetplaySignalMessage"
      ADD CONSTRAINT "NetplaySignalMessage_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "NetplayParticipant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- privilege-reviewed: 2025-02-28 security hardening checklist automation
