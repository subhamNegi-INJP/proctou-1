/*
  Warnings:

  - Made the column `isCorrect` on table `Answer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `marksObtained` on table `Answer` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "testResults" TEXT,
ALTER COLUMN "isCorrect" SET NOT NULL,
ALTER COLUMN "isCorrect" SET DEFAULT false,
ALTER COLUMN "marksObtained" SET NOT NULL,
ALTER COLUMN "marksObtained" SET DEFAULT 0,
ALTER COLUMN "marksObtained" SET DATA TYPE DOUBLE PRECISION;
