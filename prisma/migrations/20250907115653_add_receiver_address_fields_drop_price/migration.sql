/*
  Warnings:

  - You are about to drop the column `price` on the `Shipment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Shipment" DROP COLUMN "price",
ADD COLUMN     "receiverAddress" TEXT,
ADD COLUMN     "receiverCity" TEXT,
ADD COLUMN     "receiverPoBox" TEXT;
