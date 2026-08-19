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
 */

export interface ChecklistUpdateData {
  checked?: boolean
  item?: string
  checkedAt?: Date
}

export type ChecklistWrite =
  | { kind: "apply"; data: ChecklistUpdateData }
  | { kind: "conflict" }

export interface ChecklistWriteBody {
  checked?: unknown
  item?: unknown
  ts?: unknown
}

export function resolveChecklistWrite(
  body: ChecklistWriteBody,
  existing: { checkedAt: Date | null },
  now: Date = new Date()
): ChecklistWrite {
  const data: ChecklistUpdateData = {}

  if (typeof body.item === "string") {
    data.item = body.item
  }

  if (typeof body.checked === "boolean") {
    data.checked = body.checked

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
