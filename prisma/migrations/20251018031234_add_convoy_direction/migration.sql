/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Convoy` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[date,direction]` on the table `Convoy` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."Direction" AS ENUM ('GN_TO_CA', 'CA_TO_GN');

-- DropIndex
DROP INDEX "public"."Convoy_date_key";

-- AlterTable
ALTER TABLE "public"."Convoy" DROP COLUMN "createdAt",
ADD COLUMN     "direction" "public"."Direction" NOT NULL DEFAULT 'GN_TO_CA';

-- CreateIndex
CREATE UNIQUE INDEX "Convoy_date_direction_key" ON "public"."Convoy"("date", "direction");
