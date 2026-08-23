/**
 * One-off backfill for Attraction.attractionType.
 *
 * Rows saved before the column existed have no stored Google Place type, so they
 * fall back to the generic landmark icon. This re-fetches Place Details for each
 * one and fills the value in.
 *
 * Usage:
 *   npx tsx scripts/backfill-attraction-types.ts --dry-run
 *   npx tsx scripts/backfill-attraction-types.ts --limit 20
 *   npx tsx scripts/backfill-attraction-types.ts
 *
 * Safe to re-run: it only ever looks at rows where attractionType IS NULL, and
 * never nulls out a value that is already set. A row whose place id no longer
 * resolves is logged and skipped rather than failing the run.
 */

import "dotenv/config"

import { prisma } from "../src/lib/prisma"
import { getPlaceDetails } from "../src/lib/google-maps"
import { mapAttractionType } from "../src/lib/attraction-types"

/** Places API courtesy delay between calls. */
const DELAY_MS = 120

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const dryRun = process.argv.includes("--dry-run")
const limit = Number(arg("limit")) || undefined

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const rows = await prisma.attraction.findMany({
    where: { attractionType: null, googlePlaceId: { not: null } },
    select: { id: true, name: true, googlePlaceId: true },
    take: limit,
  })

  console.log(
    `${rows.length} attraction(s) to check${dryRun ? " (dry run — nothing will be written)" : ""}`
  )

  let filled = 0
  let unmatched = 0
  let errored = 0

  for (const [i, row] of rows.entries()) {
    try {
      const details = await getPlaceDetails(row.googlePlaceId!, "id,types")
      const resolved = mapAttractionType(details.types ?? [])

      if (!resolved) {
        unmatched++
        // Log the raw types so gaps in attractionTypeMap are visible and can be
        // filled in a follow-up rather than silently defaulting to landmark.
        console.log(
          `  [${i + 1}/${rows.length}] ${row.name} — no matching type (${(details.types ?? []).join(", ") || "none"})`
        )
      } else {
        if (!dryRun) {
          await prisma.attraction.update({
            where: { id: row.id },
            data: { attractionType: resolved },
          })
        }
        filled++
        console.log(`  [${i + 1}/${rows.length}] ${row.name} → ${resolved}`)
      }
    } catch (error) {
      errored++
      console.error(
        `  [${i + 1}/${rows.length}] ${row.name} — failed:`,
        error instanceof Error ? error.message : error
      )
    }

    if (i < rows.length - 1) await sleep(DELAY_MS)
  }

  console.log(
    `\nscanned ${rows.length} · filled ${filled} · unmatched ${unmatched} · errored ${errored}`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
