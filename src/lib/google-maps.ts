const API_KEY = process.env.GOOGLE_MAPS_API_KEY!

interface LatLng {
  latitude: number
  longitude: number
}

export interface PlaceResult {
  id: string
  displayName: { text: string; languageCode?: string }
  formattedAddress: string
  rating?: number
  userRatingCount?: number
  photos?: Array<{ name: string }>
  location: LatLng
  types?: string[]
  editorialSummary?: { text: string }
}

export interface PlaceDetails {
  id: string
  displayName: { text: string; languageCode?: string }
  formattedAddress: string
  rating?: number
  userRatingCount?: number
  photos?: Array<{ name: string }>
  location: LatLng
  regularOpeningHours?: {
    weekdayDescriptions?: string[]
    openNow?: boolean
  }
  internationalPhoneNumber?: string
  websiteUri?: string
  editorialSummary?: { text: string }
  priceLevel?: string
  types?: string[]
}

export interface RouteResult {
  durationMinutes: number
  distanceKm: number
}

export async function searchPlaces(
  query: string,
  location: { lat: number; lng: number },
  radius: number,
  type?: string
): Promise<PlaceResult[]> {
  const fieldMask =
    "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.photos,places.location,places.types,places.editorialSummary"

  const body: Record<string, unknown> = {
    textQuery: type ? `${type} ${query}` : query,
    locationBias: {
      circle: {
        center: {
          latitude: location.lat,
          longitude: location.lng,
        },
        radius,
      },
    },
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Places search failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  return data.places ?? []
}

export async function getPlaceDetails(
  placeId: string,
  fields?: string
): Promise<PlaceDetails> {
  const fieldMask =
    fields ??
    "id,displayName,formattedAddress,rating,userRatingCount,photos,location,regularOpeningHours,internationalPhoneNumber,websiteUri,editorialSummary,priceLevel,types"

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": fieldMask,
      },
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Place details failed: ${response.status} ${error}`)
  }

  return response.json()
}

export async function calculateRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteResult> {
  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Route calculation failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  const route = data.routes?.[0]

  if (!route) {
    throw new Error("No route found")
  }

  // duration comes as "123s" string
  const durationSeconds = parseInt(route.duration?.replace("s", "") ?? "0", 10)
  const distanceMeters = route.distanceMeters ?? 0

  return {
    durationMinutes: Math.round(durationSeconds / 60),
    distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
  }
}
