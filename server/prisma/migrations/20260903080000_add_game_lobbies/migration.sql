CREATE TYPE "GameMode" AS ENUM ('ONE_V_ONE', 'ONE_V_ONE_V_THREE');
CREATE TYPE "GameInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
CREATE TYPE "GameLobbyStatus" AS ENUM ('WAITING', 'READY');

CREATE TABLE "GameLobby" (
    "id" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "status" "GameLobbyStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameLobby_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameInvite" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "inviteeId" INTEGER NOT NULL,
    "status" "GameInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameLobby_id_key" ON "GameLobby"("id");
CREATE INDEX "GameLobby_creatorId_status_idx" ON "GameLobby"("creatorId", "status");
CREATE UNIQUE INDEX "GameInvite_lobbyId_inviteeId_key" ON "GameInvite"("lobbyId", "inviteeId");
CREATE INDEX "GameInvite_inviteeId_status_idx" ON "GameInvite"("inviteeId", "status");

ALTER TABLE "GameLobby" ADD CONSTRAINT "GameLobby_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameInvite" ADD CONSTRAINT "GameInvite_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "GameLobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameInvite" ADD CONSTRAINT "GameInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;