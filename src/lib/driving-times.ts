import { calculateRoute } from "./google-maps"

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
      const route = await calculateRoute(acc.coordinates, dest)
      results.push({
        accommodationName: acc.name || "לינה",
        minutes: route.durationMinutes,
      })
    } catch {
      // Skip this accommodation if route calculation fails
    }
  }

  return results
}
