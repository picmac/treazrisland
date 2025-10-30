-- CreateTable
CREATE TABLE "UserRomFavorite" (
    "userId" TEXT NOT NULL,
    "romId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserRomFavorite_pkey" PRIMARY KEY ("userId", "romId")
);

-- CreateTable
CREATE TABLE "RomCollection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "RomCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RomCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "romId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RomCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RomTopList" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publishedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "RomTopList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RomTopListEntry" (
    "id" TEXT NOT NULL,
    "topListId" TEXT NOT NULL,
    "romId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "blurb" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RomTopListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRomFavorite_romId_idx" ON "UserRomFavorite"("romId");

-- CreateIndex
CREATE UNIQUE INDEX "RomCollection_slug_key" ON "RomCollection"("slug");

-- CreateIndex
CREATE INDEX "RomCollection_isPublished_idx" ON "RomCollection"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "RomCollectionItem_collectionId_romId_key" ON "RomCollectionItem"("collectionId", "romId");

-- CreateIndex
CREATE UNIQUE INDEX "RomCollectionItem_collectionId_position_key" ON "RomCollectionItem"("collectionId", "position");

-- CreateIndex
CREATE INDEX "RomCollectionItem_romId_idx" ON "RomCollectionItem"("romId");

-- CreateIndex
CREATE UNIQUE INDEX "RomTopList_slug_key" ON "RomTopList"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RomTopListEntry_topListId_romId_key" ON "RomTopListEntry"("topListId", "romId");

-- CreateIndex
CREATE UNIQUE INDEX "RomTopListEntry_topListId_rank_key" ON "RomTopListEntry"("topListId", "rank");

-- CreateIndex
CREATE INDEX "RomTopListEntry_romId_idx" ON "RomTopListEntry"("romId");

-- AddForeignKey
ALTER TABLE "UserRomFavorite" ADD CONSTRAINT "UserRomFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRomFavorite" ADD CONSTRAINT "UserRomFavorite_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomCollection" ADD CONSTRAINT "RomCollection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomCollectionItem" ADD CONSTRAINT "RomCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "RomCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomCollectionItem" ADD CONSTRAINT "RomCollectionItem_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomTopList" ADD CONSTRAINT "RomTopList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomTopListEntry" ADD CONSTRAINT "RomTopListEntry_topListId_fkey" FOREIGN KEY ("topListId") REFERENCES "RomTopList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RomTopListEntry" ADD CONSTRAINT "RomTopListEntry_romId_fkey" FOREIGN KEY ("romId") REFERENCES "Rom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
