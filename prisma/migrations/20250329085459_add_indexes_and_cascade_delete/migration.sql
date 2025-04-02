/*
  Warnings:

  - The values [EXAM] on the enum `ExamType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `content` on the `Answer` table. All the data in the column will be lost.
  - You are about to drop the column `creatorId` on the `Exam` table. All the data in the column will be lost.
  - You are about to alter the column `score` on the `ExamAttempt` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the column `points` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `bio` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[attemptId,questionId]` on the table `Answer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[examId,userId]` on the table `ExamAttempt` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `answer` to the `Answer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `Exam` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Exam` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalMarks` to the `Exam` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Exam` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `Exam` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `ExamAttempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `marks` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "AttemptStatus" ADD VALUE 'NOT_STARTED';

-- AlterEnum
ALTER TYPE "ExamStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
BEGIN;
CREATE TYPE "ExamType_new" AS ENUM ('QUIZ', 'CODING', 'ASSIGNMENT');
ALTER TABLE "Exam" ALTER COLUMN "type" TYPE "ExamType_new" USING ("type"::text::"ExamType_new");
ALTER TYPE "ExamType" RENAME TO "ExamType_old";
ALTER TYPE "ExamType_new" RENAME TO "ExamType";
DROP TYPE "ExamType_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuestionType" ADD VALUE 'SINGLE_CHOICE';
ALTER TYPE "QuestionType" ADD VALUE 'TRUE_FALSE';
ALTER TYPE "QuestionType" ADD VALUE 'LONG_ANSWER';

-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_attemptId_fkey";

-- DropForeignKey
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "ExamAttempt" DROP CONSTRAINT "ExamAttempt_examId_fkey";

-- DropForeignKey
ALTER TABLE "ExamAttempt" DROP CONSTRAINT "ExamAttempt_userId_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_examId_fkey";

-- AlterTable
ALTER TABLE "Answer" DROP COLUMN "content",
ADD COLUMN     "answer" TEXT NOT NULL,
ADD COLUMN     "marksObtained" INTEGER;

-- AlterTable
ALTER TABLE "Exam" DROP COLUMN "creatorId",
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "totalMarks" INTEGER NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "description" SET NOT NULL;

-- AlterTable
ALTER TABLE "ExamAttempt" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "score" SET DATA TYPE INTEGER,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "points",
ADD COLUMN     "correctAnswer" TEXT,
ADD COLUMN     "marks" INTEGER NOT NULL,
ADD COLUMN     "question" TEXT NOT NULL,
ALTER COLUMN "content" DROP NOT NULL,
ALTER COLUMN "answer" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "bio",
DROP COLUMN "website",
ALTER COLUMN "name" DROP NOT NULL;

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "examId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "File_examId_idx" ON "File"("examId");

-- CreateIndex
CREATE INDEX "File_createdAt_idx" ON "File"("createdAt");

-- CreateIndex
CREATE INDEX "Answer_attemptId_idx" ON "Answer"("attemptId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptId_questionId_key" ON "Answer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "Exam_userId_idx" ON "Exam"("userId");

-- CreateIndex
CREATE INDEX "Exam_type_idx" ON "Exam"("type");

-- CreateIndex
CREATE INDEX "Exam_status_idx" ON "Exam"("status");

-- CreateIndex
CREATE INDEX "Exam_startDate_endDate_idx" ON "Exam"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ExamAttempt_examId_idx" ON "ExamAttempt"("examId");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_idx" ON "ExamAttempt"("userId");

-- CreateIndex
CREATE INDEX "ExamAttempt_status_idx" ON "ExamAttempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAttempt_examId_userId_key" ON "ExamAttempt"("examId", "userId");

-- CreateIndex
CREATE INDEX "Question_examId_idx" ON "Question"("examId");

-- CreateIndex
CREATE INDEX "Question_type_idx" ON "Question"("type");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
