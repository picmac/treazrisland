-- AddForeignKey
DO $$
BEGIN
  -- Normalize legacy sessions that referenced seed states no longer available.
  IF to_regclass('"NetplaySession"') IS NOT NULL THEN
    IF to_regclass('"PlayState"') IS NOT NULL THEN
      UPDATE "NetplaySession" AS s
      SET "saveStateId" = NULL
      WHERE "saveStateId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "PlayState" AS ps WHERE ps."id" = s."saveStateId"
        );
    END IF;

    -- Drop sessions pointing at missing ROM or host records to avoid inconsistent data.
    DELETE FROM "NetplaySession" AS s
    WHERE (to_regclass('"Rom"') IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM "Rom" AS r WHERE r."id" = s."romId"
          ))
       OR (to_regclass('"User"') IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM "User" AS u WHERE u."id" = s."hostId"
          ));
  END IF;

  -- Remove participants referencing users that were pruned from the platform.
  IF to_regclass('"NetplayParticipant"') IS NOT NULL AND to_regclass('"User"') IS NOT NULL THEN
    DELETE FROM "NetplayParticipant" AS p
    WHERE NOT EXISTS (
      SELECT 1 FROM "User" AS u WHERE u."id" = p."userId"
    );
  END IF;

  IF to_regclass('"Rom"') IS NULL THEN
    RAISE EXCEPTION 'Required table "Rom" does not exist for NetplaySession_romId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetplaySession_romId_fkey'
  ) THEN
    ALTER TABLE "NetplaySession"
      ADD CONSTRAINT "NetplaySession_romId_fkey"
      FOREIGN KEY ("romId") REFERENCES "Rom"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('"User"') IS NULL THEN
    RAISE EXCEPTION 'Required table "User" does not exist for NetplaySession_hostId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetplaySession_hostId_fkey'
  ) THEN
    ALTER TABLE "NetplaySession"
      ADD CONSTRAINT "NetplaySession_hostId_fkey"
      FOREIGN KEY ("hostId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('"PlayState"') IS NULL THEN
    RAISE EXCEPTION 'Required table "PlayState" does not exist for NetplaySession_saveStateId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetplaySession_saveStateId_fkey'
  ) THEN
    ALTER TABLE "NetplaySession"
      ADD CONSTRAINT "NetplaySession_saveStateId_fkey"
      FOREIGN KEY ("saveStateId") REFERENCES "PlayState"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF to_regclass('"User"') IS NULL THEN
    RAISE EXCEPTION 'Required table "User" does not exist for NetplayParticipant_userId_fkey';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NetplayParticipant_userId_fkey'
  ) THEN
    ALTER TABLE "NetplayParticipant"
      ADD CONSTRAINT "NetplayParticipant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- privilege-reviewed: 2025-02-28 security hardening checklist automation
