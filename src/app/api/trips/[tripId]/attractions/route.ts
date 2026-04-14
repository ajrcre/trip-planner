import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { calculateRoute } from "@/lib/google-maps"
import { normalizeAccommodations } from "@/lib/accommodations"
import { requireTripAccess } from "@/lib/trip-access"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const attractions = await prisma.attraction.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(attractions)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip, role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const {
    googlePlaceId,
    name,
    description,
    address,
    lat,
    lng,
    phone,
    website,
    openingHours,
    prices,
    photos,
    ratingGoogle,
    status,
    bookingRequired,
    specialNotes,
  } = body

  // Calculate travel time from accommodation if coordinates are available
  let travelTimeMinutes: number | null = null
  let travelDistanceKm: number | null = null

  const accommodations = normalizeAccommodations(trip.accommodation)
  const accommodationWithCoords = accommodations.find((a) => a.coordinates)

  if (accommodationWithCoords?.coordinates && lat && lng) {
    try {
      const route = await calculateRoute(accommodationWithCoords.coordinates, {
        lat,
        lng,
      })
      travelTimeMinutes = route.durationMinutes
      travelDistanceKm = route.distanceKm
    } catch (error) {
      console.error("Travel time calculation failed:", error)
    }
  }

  const attraction = await prisma.attraction.create({
    data: {
      tripId,
      googlePlaceId,
      name,
      description,
      address,
      lat,
      lng,
      phone,
      website,
      openingHours,
      prices,
      photos: photos ?? [],
      ratingGoogle,
      status: status ?? "maybe",
      bookingRequired: bookingRequired ?? false,
      specialNotes,
      travelTimeMinutes,
      travelDistanceKm,
      dataSource: "google_places",
      dataLastUpdated: new Date(),
    },
  })

  return NextResponse.json(attraction, { status: 201 })
}
