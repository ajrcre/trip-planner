import { calculateRoute } from "./google-maps"

// Simple in-memory cache for route calculations
// Key: "lat1,lng1→lat2,lng2", Value: { minutes, timestamp }
const routeCache = new Map<string, { minutes: number; timestamp: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function getCacheKey(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): string {
  return `${origin.lat},${origin.lng}→${dest.lat},${dest.lng}`
}

async function getRouteMinutes(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): Promise<number> {
  const key = getCacheKey(origin, dest)
  const cached = routeCache.get(key)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.minutes
  }

  const route = await calculateRoute(origin, dest)
  routeCache.set(key, { minutes: route.durationMinutes, timestamp: Date.now() })
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
  activity: ActivityForDriving
): Promise<DrivingTimeFromLodging[]> {
  // Determine activity destination coordinates
  const destLat = activity.attraction?.lat ?? activity.restaurant?.lat ?? null
  const destLng = activity.attraction?.lng ?? activity.restaurant?.lng ?? null

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
      const minutes = await getRouteMinutes(acc.coordinates, dest)
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
