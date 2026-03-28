-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "groceryStoreId" TEXT;

-- CreateTable
CREATE TABLE "GroceryStore" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "googlePlaceId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "phone" TEXT,
    "website" TEXT,
    "openingHours" JSONB,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ratingGoogle" DOUBLE PRECISION,
    "storeType" TEXT,
    "travelTimeMinutes" INTEGER,
    "travelDistanceKm" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'maybe',
    "dataLastUpdated" TIMESTAMP(3),
    "dataSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroceryStore_tripId_idx" ON "GroceryStore"("tripId");

-- AddForeignKey
ALTER TABLE "GroceryStore" ADD CONSTRAINT "GroceryStore_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_groceryStoreId_fkey" FOREIGN KEY ("groceryStoreId") REFERENCES "GroceryStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
