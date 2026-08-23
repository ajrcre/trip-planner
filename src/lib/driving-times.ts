import {
  calculateRoute,
  isUsableDepartureTime,
  type RouteResult,
} from "./google-maps"
import { departureInstant } from "./trip-timezone"

// Simple in-memory cache for route calculations.
// Key: "lat1,lng1→lat2,lng2@<bucket>" where bucket is either the departure
// hour ("2026-09-14T09") or "live" when no departure time is known.
const routeCache = new Map<string, { minutes: number; expiresAt: number }>()

// A live-traffic answer goes stale within the hour. A prediction for a future
// slot is stable day to day, so it may be held much longer.
const LIVE_TTL_MS = 60 * 60 * 1000 // 1 hour
const FUTURE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function departureBucket(departureTime: Date | undefined): string {
  if (!departureTime) return "live"
  // Hour resolution: keeps 09:00 and 14:00 distinct while letting minor edits
  // share an entry.
  return departureTime.toISOString().slice(0, 13)
}

function getCacheKey(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  bucket: string
): string {
  return `${origin.lat},${origin.lng}→${dest.lat},${dest.lng}@${bucket}`
}

async function getRouteMinutes(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  departureTime?: Date
): Promise<number> {
  // The bucket keeps using the raw departure instant (when one exists) so
  // cache keys stay stable — only the TTL selection below depends on
  // whether the departure is actually usable.
  const bucket = departureBucket(departureTime)
  const key = getCacheKey(origin, dest, bucket)
  const cached = routeCache.get(key)

  if (cached) {
    if (Date.now() < cached.expiresAt) {
      return cached.minutes
    }
    routeCache.delete(key)
  }

  // Same predicate calculateRoute uses to decide whether to actually send
  // departureTime — a past departure gets a live-traffic answer, not a
  // future prediction, so it must not be cached as one.
  const useDeparture = isUsableDepartureTime(departureTime)

  let route: RouteResult
  let liveTraffic: boolean
  if (useDeparture) {
    try {
      // Branch rather than passing `undefined`: a trailing undefined
      // argument would break two-argument call assertions in the test suite.
      route = await calculateRoute(origin, dest, { departureTime })
      liveTraffic = false
    } catch {
      // The Routes API rejected the request — possibly because of
      // departureTime itself. Retry without it rather than losing the
      // estimate entirely; the same call without departureTime would have
      // succeeded before this feature existed.
      route = await calculateRoute(origin, dest)
      liveTraffic = true
    }
  } else {
    route = await calculateRoute(origin, dest)
    liveTraffic = true
  }

  const ttl = liveTraffic ? LIVE_TTL_MS : FUTURE_TTL_MS
  routeCache.set(key, {
    minutes: route.durationMinutes,
    expiresAt: Date.now() + ttl,
  })
  return route.durationMinutes
}

/** @internal — exported for testing only */
export function clearRouteCache() {
  routeCache.clear()
}

interface AccommodationForDriving {
  name?: string
  coordinates?: { lat: number; lng: number }
}

interface ActivityForDriving {
  attraction: { lat: number | null; lng: number | null } | null
  restaurant: { lat: number | null; lng: number | null } | null
  groceryStore: { lat: number | null; lng: number | null } | null
}

export interface DrivingTimeFromLodging {
  accommodationName: string
  minutes: number
}

/**
 * Compute driving times from each accommodation to an activity's location.
 * Returns one entry per accommodation that has coordinates.
 * Prefers attraction coords; falls back to restaurant coords.
 */
export async function computeDrivingTimesForDay(
  accommodations: AccommodationForDriving[],
  activity: ActivityForDriving,
  when?: { dayDate: Date; timeStart: string | null }
): Promise<DrivingTimeFromLodging[]> {
  // Determine activity destination coordinates
  const destLat = activity.attraction?.lat ?? activity.restaurant?.lat ?? activity.groceryStore?.lat ?? null
  const destLng = activity.attraction?.lng ?? activity.restaurant?.lng ?? activity.groceryStore?.lng ?? null

  if (destLat == null || destLng == null) return []

  const dest = { lat: destLat, lng: destLng }

  // Filter accommodations with coordinates
  const accsWithCoords = accommodations.filter(
    (a): a is AccommodationForDriving & { coordinates: { lat: number; lng: number } } =>
      a.coordinates != null
  )

  if (accsWithCoords.length === 0) return []

  const results: DrivingTimeFromLodging[] = []

  for (const acc of accsWithCoords) {
    try {
      // Resolved per accommodation: on a relocation day the two lodgings can
      // sit in different timezones.
      const departure = when
        ? await departureInstant(when.dayDate, when.timeStart, acc.coordinates)
        : undefined

      const minutes = await getRouteMinutes(acc.coordinates, dest, departure)
      results.push({
        accommodationName: acc.name || "לינה",
        minutes,
      })
    } catch {
      // Skip this accommodation if route calculation fails
    }
  }

  return results
}

/**
 * Recompute a stored travel leg's drive time at its scheduled departure.
 *
 * `driveMinutes` is written into the activity's JSON when the day is saved and
 * is never revisited, so a value captured during a one-off jam stays frozen on
 * the card indefinitely. The schedule read path calls this so driving cards
 * refresh the same way the lodging chips already do.
 *
 * The stored value is kept as a fallback: if the lookup fails, or the leg has
 * no resolved coordinates, the leg comes back untouched.
 */
export async function refreshTravelLegMinutes<
  T extends {
    driveMinutes?: number
    resolvedOrigin?: { lat: number; lng: number } | null
    resolvedDestination?: { lat: number; lng: number } | null
  }
>(leg: T | null, when?: { dayDate: Date; timeStart: string | null }): Promise<T | null> {
  if (!leg) return leg

  const from = leg.resolvedOrigin
  const to = leg.resolvedDestination
  if (from?.lat == null || from?.lng == null || to?.lat == null || to?.lng == null) {
    return leg
  }

  try {
    const departure = when
      ? await departureInstant(when.dayDate, when.timeStart, { lat: from.lat, lng: from.lng })
      : undefined

    const minutes = await getRouteMinutes(
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng },
      departure
    )
    return { ...leg, driveMinutes: minutes }
  } catch {
    // Keep whatever was stored rather than blanking the card.
    return leg
  }
}
