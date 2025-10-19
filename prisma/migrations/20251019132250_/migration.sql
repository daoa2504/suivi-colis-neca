-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'AGENT_CA', 'AGENT_NE');

-- CreateEnum
CREATE TYPE "public"."ShipmentStatus" AS ENUM ('CREATED', 'RECEIVED_IN_NIGER', 'RECEIVED_IN_CANADA', 'IN_TRANSIT', 'IN_CUSTOMS', 'ARRIVED_IN_CANADA', 'ARRIVED_IN_NIGER', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "public"."Direction" AS ENUM ('NE_TO_CA', 'CA_TO_NE');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'AGENT_NE',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Shipment" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverEmail" TEXT NOT NULL,
    "receiverPhone" TEXT,
    "originCountry" TEXT NOT NULL,
    "receiverAddress" TEXT,
    "receiverCity" TEXT,
    "receiverPoBox" TEXT,
    "destinationCountry" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "notes" TEXT,
    "status" "public"."ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convoyId" TEXT,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShipmentEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "occurredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Convoy" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "direction" "public"."Direction" NOT NULL DEFAULT 'NE_TO_CA',

    CONSTRAINT "Convoy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_trackingId_key" ON "public"."Shipment"("trackingId");

-- CreateIndex
CREATE UNIQUE INDEX "Convoy_date_direction_key" ON "public"."Convoy"("date", "direction");

-- AddForeignKey
ALTER TABLE "public"."Shipment" ADD CONSTRAINT "Shipment_convoyId_fkey" FOREIGN KEY ("convoyId") REFERENCES "public"."Convoy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "public"."Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
