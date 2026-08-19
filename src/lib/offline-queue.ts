/**
 * Queues checklist checkbox toggles made with no connection and replays them on
 * reconnect.
 *
 * Ticking off packing items on the plane is the one write worth keeping offline,
 * and it is safe to queue because a checkbox is a single boolean with no
 * server-generated state to reconcile. Everything else in the app is read-only
 * offline.
 *
 * Trips are shared, so a replay can land hours after the tap on a box someone
 * else has since changed. Each entry carries the tap time and the server applies
 * it only if it is newer (see `resolveChecklistWrite`), which is why a rejected
 * replay is a normal outcome rather than an error.
 */

const QUEUE_KEY = "tp:offline:checklistQueue"

/** Fired whenever the queue changes so the banner can show a pending count. */
export const QUEUE_EVENT = "tp:offline-queue"

export interface QueuedToggle {
  tripId: string
  /** "packing" | "shopping" | "todos" — the ChecklistManager apiPath. */
  apiPath: string
  itemId: string
  checked: boolean
  /** When the user actually tapped, which decides who wins a conflict. */
  ts: number
}

export interface ReplayResult {
  applied: number
  /** Rejected because someone changed the item more recently, or deleted it. */
  conflicts: number
  /** The user lost write access while offline; their taps were not saved. */
  forbidden: boolean
  /** Still queued because the network failed again. */
  pending: number
}

function entryKey(entry: Pick<QueuedToggle, "apiPath" | "itemId">): string {
  return `${entry.apiPath}:${entry.itemId}`
}

export function readQueue(): QueuedToggle[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(entries: QueuedToggle[]): void {
  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(QUEUE_KEY)
    } else {
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify(entries))
    }
  } catch {
    // Quota or private mode: the toggle is lost on reload, which is the same as
    // not having a queue at all.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT))
  }
}

/**
 * Toggling one box twice offline should replay once, with the final state and
 * the time of the *last* tap — that is the intent the user would expect to win.
 */
export function enqueueToggle(entry: QueuedToggle): void {
  const queue = readQueue().filter((e) => entryKey(e) !== entryKey(entry))
  queue.push(entry)
  writeQueue(queue)
}

export function queueSize(): number {
  return readQueue().length
}

/**
 * Applies pending toggles over items just read from the API.
 *
 * Necessary because an offline reload serves the *stale* cached response, which
 * still has the old checkbox values — without this overlay a tick made on the
 * plane would appear to undo itself on the next reload.
 */
export function applyPendingToggles<T extends { id: string; checked: boolean }>(
  apiPath: string,
  items: T[]
): T[] {
  const pending = readQueue().filter((e) => e.apiPath === apiPath)
  if (pending.length === 0) return items

  const byId = new Map(pending.map((e) => [e.itemId, e.checked]))
  return items.map((item) =>
    byId.has(item.id) ? { ...item, checked: byId.get(item.id)! } : item
  )
}

/**
 * Replays every queued toggle. Entries are dropped once the server has had its
 * say — successfully or not — and kept only when the network is still down, so
 * a queue can never grow unboundedly on repeated failures.
 */
export async function replayQueue(): Promise<ReplayResult> {
  const queue = readQueue()
  const result: ReplayResult = {
    applied: 0,
    conflicts: 0,
    forbidden: false,
    pending: 0,
  }
  if (queue.length === 0) return result

  const remaining: QueuedToggle[] = []

  for (const entry of queue) {
    try {
      const res = await fetch(
        `/api/trips/${entry.tripId}/${entry.apiPath}?itemId=${entry.itemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checked: entry.checked, ts: entry.ts }),
        }
      )

      if (res.ok) {
        result.applied++
      } else if (res.status === 403) {
        // Demoted to viewer while offline. Drop the entry, but the caller keeps
        // the ticks on screen and explains why — silently reverting work done on
        // a plane is the one outcome worth avoiding here.
        result.forbidden = true
      } else if (res.status === 409 || res.status === 404) {
        // Someone changed it more recently, or deleted the item outright.
        result.conflicts++
      } else {
        result.conflicts++
      }
    } catch {
      remaining.push(entry)
      result.pending++
    }
  }

  writeQueue(remaining)
  return result
}

export function clearQueue(): void {
  writeQueue([])
}
