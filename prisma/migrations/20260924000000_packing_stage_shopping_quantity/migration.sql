-- Packing items move through three marks instead of one checkbox: have it,
-- in the suitcase, verified before leaving. `stage` holds the furthest mark
-- reached (0 = none). `checked` stays and mirrors `stage >= 1`, so rows that
-- were already ticked start at stage 1 ("have it").
--
-- Shopping items get an optional quantity. NULL means none was set.

-- AlterTable
ALTER TABLE "PackingItem" ADD COLUMN "stage" INTEGER NOT NULL DEFAULT 0;

-- Backfill
UPDATE "PackingItem" SET "stage" = 1 WHERE "checked" = true;

-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN "quantity" INTEGER;
