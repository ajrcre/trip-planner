-- AlterTable
ALTER TABLE "FamilyProfile" ADD COLUMN     "carPickupDurationMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "carReturnDurationMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "preFlightArrivalMinutes" INTEGER NOT NULL DEFAULT 180;
