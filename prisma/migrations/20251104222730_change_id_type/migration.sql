/*
  Warnings:

  - The primary key for the `Shipment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Shipment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `shipmentId` on the `ShipmentEvent` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."ShipmentEvent" DROP CONSTRAINT "ShipmentEvent_shipmentId_fkey";

-- AlterTable
ALTER TABLE "public"."Shipment" DROP CONSTRAINT "Shipment_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."ShipmentEvent" DROP COLUMN "shipmentId",
ADD COLUMN     "shipmentId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
