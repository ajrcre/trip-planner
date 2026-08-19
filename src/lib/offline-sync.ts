/**
 * Decides what the service worker should pre-download so the app stays usable
 * with no connection, and drives that warm-up from the client.
 *
 * Runs on every online visit rather than behind a "download this trip" button:
 * the whole point is that the user should not have to remember to prepare the
 * app before boarding a plane or landing somewhere without signal.
 */

const LAST_SYNC_KEY = "tp:offline:lastSync"
const SYNCED_USER_KEY = "tp:offline:userId"
const WARM_THROTTLE_MS = 5 * 60 * 1000

/** Fired after a warm-up completes so the offline banner can show a fresh age. */
export const SYNC_EVENT = "tp:offline-sync"

/**
 * Everything a trip page reads. The fat /api/trips/<id> payload already carries
 * attractions, restaurants, grocery stores, day plans and list items, but the
 * tabs each re-fetch their own endpoint, so those need caching in their own
 * right.
 */
const TRIP_SUBRESOURCES = [
  "attractions",
  "restaurants",
  "grocery-stores",
  "schedule",
  "weather",
  "profile",
  "packing",
  "shopping",
  "todos",
  "members",
] as const

export interface WarmableTrip {
  id: string
  endDate: string | Date
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * A trip is worth caching until the day it ends — that is exactly when the user
 * is most likely to have no signal.
 *
 * Two timezones meet here and neither is negotiable: `endDate` is a date-only
 * value stored at UTC midnight, while "today" is whatever day it is on the
 * device — which, on this app, is usually a foreign one. Reading `endDate` in
 * local time would shift it a day earlier for anyone west of UTC and evict a
 * trip's cache while they are still on it.
 *
 * So the end day is read in UTC, the current day locally, and a day of grace
 * absorbs the offset (max ±14h, always under a day). The error can then only go
 * one way: a finished trip stays cached an extra day, which costs nothing.
 */
export function isTripActive(trip: WarmableTrip, now: Date = new Date()): boolean {
  const end = new Date(trip.endDate)
  if (Number.isNaN(end.getTime())) return false

  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return endDay >= today - DAY_MS
}

export function selectActiveTrips<T extends WarmableTrip>(
  trips: T[],
  now: Date = new Date()
): T[] {
  return trips.filter((t) => isTripActive(t, now))
}

/**
 * Ordered by how badly the app needs each URL offline, because warm-up runs
 * sequentially and may be cut short by a dying connection. The session comes
 * first: without it every page treats the user as signed out and redirects away,
 * so it is worth more than any trip data.
 */
export function buildWarmUrls(tripIds: string[]): string[] {
  const urls = [
    "/api/auth/session",
    "/api/trips",
    "/trips",
    "/trips/new",
    "/family",
    "/api/family",
  ]

  for (const id of tripIds) {
    urls.push(`/trips/${id}`)
    urls.push(`/api/trips/${id}`)
    for (const sub of TRIP_SUBRESOURCES) {
      urls.push(`/api/trips/${id}/${sub}`)
    }
  }

  return urls
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode / quota. Warm-up still works, it just re-runs more often.
  }
}

export function getLastSyncAt(): Date | null {
  const raw = readStorage(LAST_SYNC_KEY)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function controller(): ServiceWorker | null {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null
  return navigator.serviceWorker.controller
}

/**
 * Cache storage is per-origin, so a second account signing in on the same device
 * would otherwise inherit the first account's trips offline.
 */
export async function purgeOfflineCaches(): Promise<void> {
  const sw = controller()
  sw?.postMessage({ type: "PURGE" })
  try {
    window.localStorage.removeItem(LAST_SYNC_KEY)
    window.localStorage.removeItem(SYNCED_USER_KEY)
  } catch {
    // Nothing to clean up.
  }
}

export async function syncOfflineCaches(
  userId: string | undefined,
  options: { force?: boolean } = {}
): Promise<void> {
  const sw = controller()
  if (!sw || !navigator.onLine) return

  if (userId && readStorage(SYNCED_USER_KEY) !== userId) {
    await purgeOfflineCaches()
  } else if (!options.force) {
    const last = getLastSyncAt()
    if (last && Date.now() - last.getTime() < WARM_THROTTLE_MS) return
  }

  let trips: WarmableTrip[]
  try {
    const res = await fetch("/api/trips")
    if (!res.ok) return
    trips = await res.json()
  } catch {
    return
  }

  if (!Array.isArray(trips)) return

  const ids = selectActiveTrips(trips).map((t) => t.id)
  sw.postMessage({ type: "WARM", urls: buildWarmUrls(ids) })

  writeStorage(LAST_SYNC_KEY, new Date().toISOString())
  if (userId) writeStorage(SYNCED_USER_KEY, userId)
  window.dispatchEvent(new CustomEvent(SYNC_EVENT))
}
