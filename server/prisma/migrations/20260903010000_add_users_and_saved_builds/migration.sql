CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedBuild" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedBuild_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedBuildSlot" (
    "id" SERIAL NOT NULL,
    "savedBuildId" INTEGER NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    CONSTRAINT "SavedBuildSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "SavedBuildSlot_savedBuildId_categorySlug_key" ON "SavedBuildSlot"("savedBuildId", "categorySlug");
CREATE INDEX "SavedBuild_userId_idx" ON "SavedBuild"("userId");

ALTER TABLE "SavedBuild" ADD CONSTRAINT "SavedBuild_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedBuildSlot" ADD CONSTRAINT "SavedBuildSlot_savedBuildId_fkey" FOREIGN KEY ("savedBuildId") REFERENCES "SavedBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedBuildSlot" ADD CONSTRAINT "SavedBuildSlot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
