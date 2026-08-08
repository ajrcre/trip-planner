-- Reconciles migration history with the schema that existing databases already
-- have. Three changes were applied to live databases via `prisma db push` and
-- were never recorded as migrations:
--
--   1. the ActivityAlternative table (added with the schedule alternatives work)
--   2. FamilyProfile.additionalContext
--   3. removal of Trip.shareToken, which the sharing rework replaced with the
--      TripShare / TripInvite tables
--
-- Existing databases already match this state, so they take this migration via
-- `prisma migrate resolve --applied` and nothing here runs against their data.
-- Fresh databases run it for real and land in the same place.

-- CreateTable
CREATE TABLE "ActivityAlternative" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "notes" TEXT,
    "attractionId" TEXT,
    "restaurantId" TEXT,
    "groceryStoreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityAlternative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityAlternative_activityId_idx" ON "ActivityAlternative"("activityId");

-- AddForeignKey
ALTER TABLE "ActivityAlternative" ADD CONSTRAINT "ActivityAlternative_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAlternative" ADD CONSTRAINT "ActivityAlternative_attractionId_fkey" FOREIGN KEY ("attractionId") REFERENCES "Attraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAlternative" ADD CONSTRAINT "ActivityAlternative_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAlternative" ADD CONSTRAINT "ActivityAlternative_groceryStoreId_fkey" FOREIGN KEY ("groceryStoreId") REFERENCES "GroceryStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "FamilyProfile" ADD COLUMN "additionalContext" TEXT;

-- DropIndex
DROP INDEX "Trip_shareToken_key";

-- AlterTable
ALTER TABLE "Trip" DROP COLUMN "shareToken";
