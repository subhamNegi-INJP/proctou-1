/*
  Warnings:

  - A unique constraint covering the columns `[examCode]` on the table `Exam` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `examCode` to the `Exam` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "examCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Exam_examCode_key" ON "Exam"("examCode");
