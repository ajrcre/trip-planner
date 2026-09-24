/**
 * Shared write resolution for the three checklist PUT handlers (packing,
 * shopping, todos), which are otherwise identical.
 *
 * Trips are shared, so several people edit one list. A toggle made offline is
 * queued and replayed on reconnect, which can be hours after the tap — long
 * enough for someone else to have changed the same box. Replays therefore carry
 * `ts` (when the user actually tapped) and are applied only if that is newer
 * than the row's `checkedAt`. Live online toggles send no `ts` and always win,
 * so normal editing is unchanged.
 *
 * Clock skew can only cause a replay to be *rejected* — visible to the user and
 * re-doable — never to silently overwrite a newer change.
 *
 * Packing items also carry a `stage` (have it → in the suitcase → verified). A
 * stage change is a checkbox change in every sense that matters here: it goes
 * through the same `ts` guard and keeps `checked` equal to `stage >= 1`.
 */

/** Highest packing stage: 1 = have it, 2 = in the suitcase, 3 = verified. */
export const MAX_STAGE = 3

export interface ChecklistUpdateData {
  checked?: boolean
  item?: string
  checkedAt?: Date
  stage?: number
  quantity?: number | null
}

export type ChecklistWrite =
  | { kind: "apply"; data: ChecklistUpdateData }
  | { kind: "conflict" }

export interface ChecklistWriteBody {
  checked?: unknown
  item?: unknown
  ts?: unknown
  stage?: unknown
  quantity?: unknown
}

/**
 * Which optional columns the list's table has. Fields a list does not support
 * are ignored rather than passed on to Prisma, which would reject them.
 */
export interface ChecklistFields {
  stage?: boolean
  quantity?: boolean
}

function isStage(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_STAGE
}

/** A positive whole number, or null to clear it. Anything else is not a quantity. */
export function parseQuantity(value: unknown): number | null | undefined {
  if (value === null) return null
  if (Number.isInteger(value) && (value as number) > 0) return value as number
  return undefined
}

export function resolveChecklistWrite(
  body: ChecklistWriteBody,
  existing: { checkedAt: Date | null; stage?: number },
  now: Date = new Date(),
  fields: ChecklistFields = {}
): ChecklistWrite {
  const data: ChecklistUpdateData = {}

  if (typeof body.item === "string") {
    data.item = body.item
  }

  if (fields.quantity) {
    const quantity = parseQuantity(body.quantity)
    if (quantity !== undefined) data.quantity = quantity
  }

  let marked = false

  if (fields.stage && isStage(body.stage)) {
    data.stage = body.stage
    data.checked = body.stage > 0
    marked = true
  } else if (typeof body.checked === "boolean") {
    data.checked = body.checked
    if (fields.stage) {
      // A plain tick on a staged list means "have it"; unticking clears every
      // stage. Ticking an item that is already further along leaves it there.
      data.stage = body.checked ? Math.max(existing.stage ?? 0, 1) : 0
    }
    marked = true
  }

  if (marked) {
    // A replayed offline toggle. Guard it against the last recorded change.
    if (typeof body.ts === "number" && Number.isFinite(body.ts)) {
      if (existing.checkedAt && body.ts <= existing.checkedAt.getTime()) {
        return { kind: "conflict" }
      }
      data.checkedAt = new Date(body.ts)
    } else {
      data.checkedAt = now
    }
  }

  return { kind: "apply", data }
}
