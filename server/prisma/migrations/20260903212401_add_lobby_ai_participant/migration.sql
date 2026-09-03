-- DropIndex
DROP INDEX "GameLobby_id_key";

-- AlterTable
ALTER TABLE "GameLobby" ADD COLUMN     "includesAi" BOOLEAN NOT NULL DEFAULT false;
