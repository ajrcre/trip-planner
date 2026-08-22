-- travelTimeToNextMinutes was always NULL: nothing ever wrote a real value to it and
-- nothing read it back. The per-leg travel times computed by this branch replace it.
--
-- IF EXISTS because this repo has documented `prisma db push` drift (see
-- 20260807130000_reconcile_schema_drift) and a hand-applied push may already have
-- dropped this column outside of migration history.
--
-- Must be applied only after the new code ships: the old code writes
-- `travelTimeToNextMinutes: null` on every day save and would 500 once this column
-- is gone.

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "travelTimeToNextMinutes";
