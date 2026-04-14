import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { calculateRoute } from "@/lib/google-maps"
import { normalizeAccommodations } from "@/lib/accommodations"
import { requireTripAccess } from "@/lib/trip-access"
import { mapCuisineType } from "@/lib/cuisine-types"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const restaurants = await prisma.restaurant.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(restaurants)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip } = result

  const body = await request.json()
  const {
    googlePlaceId,
    name,
    cuisineType,
    address,
    lat,
    lng,
    phone,
    website,
    openingHours,
    photos,
    ratingGoogle,
    status,
    kidFriendly,
    types,
  } = body

  // Calculate travel time from accommodation if coordinates are available
  let travelTimeMinutes: number | null = null

  const accommodations = normalizeAccommodations(trip.accommodation)
  const accommodationWithCoords = accommodations.find((a) => a.coordinates)

  if (accommodationWithCoords?.coordinates && lat && lng) {
    try {
      const route = await calculateRoute(accommodationWithCoords.coordinates, {
        lat,
        lng,
      })
      travelTimeMinutes = route.durationMinutes
    } catch (error) {
      console.error("Travel time calculation failed:", error)
    }
  }

  // Map cuisine type from Google Places types if not provided directly
  const resolvedCuisineType = cuisineType ?? mapCuisineType(types ?? [])

  const restaurant = await prisma.restaurant.create({
    data: {
      tripId,
      googlePlaceId,
      name,
      cuisineType: resolvedCuisineType,
      address,
      lat,
      lng,
      phone,
      website,
      openingHours,
      photos: photos ?? [],
      ratingGoogle,
      status: status ?? "maybe",
      kidFriendly: kidFriendly ?? false,
      travelTimeMinutes,
      dataSource: "google_places",
      dataLastUpdated: new Date(),
    },
  })

  return NextResponse.json(restaurant, { status: 201 })
}
