import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { searchPlaces, calculateRoute } from "@/lib/google-maps"
import { normalizeAccommodations } from "@/lib/accommodations"

async function verifyTripAccess(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { shares: true },
  })

  if (!trip) return null

  const isOwner = trip.userId === userId
  const isShared = trip.shares.some((s) => s.userId === userId)

  if (!isOwner && !isShared) return null

  return trip
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json()
  const { query, types, radius } = body as {
    query?: string
    types?: string[]
    radius?: number
  }

  // Get accommodation coordinates for location bias
  const accommodations = normalizeAccommodations(trip.accommodation)
  const accommodationWithCoords = accommodations.find((a) => a.coordinates)

  const location = accommodationWithCoords?.coordinates
  if (!location) {
    return NextResponse.json(
      { error: "הוסף כתובת לינה עם קואורדינטות לפני חיפוש אטרקציות" },
      { status: 400 }
    )
  }
  const searchRadius = radius ?? 50000

  // Build search query
  const searchQuery = query || `${trip.destination} attractions`
  const typeString = types?.length ? types.join(" ") : undefined

  try {
    const results = await searchPlaces(
      searchQuery,
      location,
      searchRadius,
      typeString
    )

    // Map basic results (max 20)
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
      websiteUri: place.websiteUri ?? null,
      openingHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
      travelTimeMinutes: null as number | null,
      distanceKm: null as number | null,
    }))

    // Calculate travel times from accommodation in parallel
    const routePromises = places.map(async (place) => {
      if (place.lat == null || place.lng == null) return place
      try {
        const route = await calculateRoute(
          { lat: location.lat, lng: location.lng },
          { lat: place.lat, lng: place.lng }
        )
        place.travelTimeMinutes = route.durationMinutes
        place.distanceKm = route.distanceKm
      } catch {
        // Travel time unavailable — leave as null
      }
      return place
    })

    const enriched = await Promise.all(routePromises)

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Discovery search failed:", error)
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    )
  }
}
