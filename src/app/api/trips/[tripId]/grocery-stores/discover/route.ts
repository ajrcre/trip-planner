import { NextResponse } from "next/server"

import { searchPlaces, calculateRoute, geocodeAddress } from "@/lib/google-maps"
import { normalizeAccommodations } from "@/lib/accommodations"
import { requireTripAccess } from "@/lib/trip-access"
import { mapStoreType } from "@/lib/store-types"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip } = result

  const body = await request.json()
  const { query, types, radius, accommodationId } = body as {
    query?: string
    types?: string[]
    radius?: number
    accommodationId?: string
  }

  // Get accommodation coordinates for location bias
  const accommodations = normalizeAccommodations(trip.accommodation)

  // Use selected accommodation or fall back to first with coordinates
  let selectedAccommodation = accommodations.find((a) => a.coordinates)
  if (accommodationId) {
    const byId = accommodations.find(
      (a, i) => `${i}` === accommodationId || a.name === accommodationId
    )
    if (byId) selectedAccommodation = byId
  }

  let location = selectedAccommodation?.coordinates ?? null
  if (!location && selectedAccommodation) {
    const addressStr = selectedAccommodation.address || selectedAccommodation.name
    if (addressStr) location = await geocodeAddress(addressStr)
  }
  const searchRadius = radius ?? 50000

  const searchQuery = query || `grocery store ${trip.destination}`
  const typeString = types?.length ? types.join(" ") : undefined

  try {
    const results = await searchPlaces(
      searchQuery,
      location,
      searchRadius,
      typeString
    )

    const places = results.slice(0, 20).map((place) => ({
      googlePlaceId: place.id,
      name: place.displayName?.text ?? "",
      description: place.editorialSummary?.text ?? null,
      address: place.formattedAddress ?? null,
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      photos: place.photos?.map((p) => p.name) ?? [],
      types: place.types ?? [],
      storeType: mapStoreType(place.types ?? []),
      websiteUri: place.websiteUri ?? null,
      openingHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
      travelTimeMinutes: null as number | null,
      distanceKm: null as number | null,
    }))

    // Calculate travel times from accommodation in parallel
    const routePromises = places.map(async (place) => {
      if (place.lat == null || place.lng == null || location == null) return place
      try {
        const route = await calculateRoute(
          { lat: location.lat, lng: location.lng },
          { lat: place.lat, lng: place.lng }
        )
        place.travelTimeMinutes = route.durationMinutes
        place.distanceKm = route.distanceKm
      } catch {
        // Travel time unavailable
      }
      return place
    })

    const enriched = await Promise.all(routePromises)

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Grocery store discovery search failed:", error)
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    )
  }
}
