-- DropForeignKey
ALTER TABLE "GameQuestion" DROP CONSTRAINT "GameQuestion_wordId_fkey";

-- AlterTable
ALTER TABLE "GameQuestion" DROP COLUMN "wordId";

