-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "level" TEXT NOT NULL DEFAULT 'CET4',
    "hostId" TEXT NOT NULL,
    "guestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,

    CONSTRAINT "WordList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "meaning" TEXT NOT NULL,
    "meaningCn" TEXT NOT NULL,
    "example" TEXT,
    "wordListId" TEXT NOT NULL,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "wordLevel" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT,
    "winnerId" TEXT,
    "score1" INTEGER NOT NULL DEFAULT 0,
    "score2" INTEGER NOT NULL DEFAULT 0,
    "totalQ" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameQuestion" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "wordId" TEXT,
    "type" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "answer1" TEXT,
    "answer2" TEXT,
    "correct1" BOOLEAN NOT NULL DEFAULT false,
    "correct2" BOOLEAN NOT NULL DEFAULT false,
    "time1" INTEGER,
    "time2" INTEGER,

    CONSTRAINT "GameQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE INDEX "Room_expiresAt_idx" ON "Room"("expiresAt");

-- CreateIndex
CREATE INDEX "Room_hostId_idx" ON "Room"("hostId");

-- CreateIndex
CREATE INDEX "Word_wordListId_idx" ON "Word"("wordListId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_clientId_key" ON "Game"("clientId");

-- CreateIndex
CREATE INDEX "Game_player1Id_idx" ON "Game"("player1Id");

-- CreateIndex
CREATE INDEX "Game_player2Id_idx" ON "Game"("player2Id");

-- CreateIndex
CREATE INDEX "Game_createdAt_idx" ON "Game"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "GameQuestion_gameId_idx" ON "GameQuestion"("gameId");

-- CreateIndex
CREATE INDEX "Score_mode_level_score_idx" ON "Score"("mode", "level", "score" DESC);

-- CreateIndex
CREATE INDEX "Score_userId_mode_level_idx" ON "Score"("userId", "mode", "level");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_wordListId_fkey" FOREIGN KEY ("wordListId") REFERENCES "WordList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameQuestion" ADD CONSTRAINT "GameQuestion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameQuestion" ADD CONSTRAINT "GameQuestion_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Table hardening (not modelled by Prisma, so it is appended by hand).
--
-- Supabase grants the PostgREST roles (anon/authenticated) full DML on every
-- table created in "public" via default privileges, and the anon key is shipped
-- to the browser (NEXT_PUBLIC_SUPABASE_ANON_KEY). Without policies that made
-- Game/Score/Word/... readable *and writable* by anyone holding that key —
-- which also bypassed the API's score validation.
--
-- The app only reaches these tables through Prisma as "postgres" (BYPASSRLS) and
-- uses the anon key exclusively for Realtime, so enabling RLS with no policies
-- plus revoking the grants removes the front door without affecting the app.
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WordList" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Word" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Game" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GameQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Score" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM anon, authenticated;

-- Keep future tables closed as well
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "public"
  REVOKE ALL ON TABLES FROM anon, authenticated;
