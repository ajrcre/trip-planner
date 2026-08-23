-- Stores the Google Place type ("museum", "zoo", "beach") behind each attraction
-- so the UI can pick a matching icon instead of drawing every attraction as the
-- same generic landmark. The Places field mask already requests `types` and the
-- discover endpoint already returns them; until now the value was simply dropped
-- on save.
--
-- Holds the Google type key rather than a display label, unlike Restaurant.cuisineType
-- and GroceryStore.storeType. The key is what the icon lookup keys off, and the
-- Hebrew label stays derivable from it (see src/lib/attraction-types.ts).
--
-- Nullable with no backfill: rows saved before this column existed have an unknown
-- type, and NULL falls back to the generic landmark icon. A one-off script
-- (scripts/backfill-attraction-types.ts) fills them in from Place Details.

-- AlterTable
ALTER TABLE "Attraction" ADD COLUMN "attractionType" TEXT;
