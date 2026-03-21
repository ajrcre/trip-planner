import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateRoute } from "@/lib/google-maps"

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

export async function GET(
  _request: Request,
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

  const accommodation = trip.accommodation as {
    coordinates?: { lat: number; lng: number }
  } | null

  if (accommodation?.coordinates && lat && lng) {
    try {
      const route = await calculateRoute(accommodation.coordinates, {
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
