-- Records when each checklist checkbox last changed, so a toggle made offline and
-- replayed on reconnect can be rejected if someone else changed the same box more
-- recently. Without it the PUT handlers are blind writes and a stale offline tick
-- silently overwrites a newer change.
--
-- Nullable with no backfill: existing rows have an unknown last-change time, and
-- a NULL checkedAt means "no recorded change", which the guard treats as
-- always-losing so the first write of any kind wins.

-- AlterTable
ALTER TABLE "PackingItem" ADD COLUMN "checkedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ShoppingItem" ADD COLUMN "checkedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TodoItem" ADD COLUMN "checkedAt" TIMESTAMP(3);
