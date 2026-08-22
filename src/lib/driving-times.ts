import { calculateRoute } from "./google-maps"
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
  const bucket = departureBucket(departureTime)
  const key = getCacheKey(origin, dest, bucket)
  const cached = routeCache.get(key)

  if (cached && Date.now() < cached.expiresAt) {
    return cached.minutes
  }

  // Branch rather than passing `undefined`: a trailing undefined argument
  // would break two-argument call assertions in the test suite.
  const route = departureTime
    ? await calculateRoute(origin, dest, { departureTime })
    : await calculateRoute(origin, dest)

  const ttl = departureTime ? FUTURE_TTL_MS : LIVE_TTL_MS
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
