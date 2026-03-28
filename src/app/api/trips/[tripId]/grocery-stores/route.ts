import { NextResponse } from "next/server"

import { searchPlaces, calculateRoute } from "@/lib/google-maps"
import { normalizeAccommodations } from "@/lib/accommodations"
import { requireTripAccess } from "@/lib/trip-access"
import { mapStoreType } from "@/lib/store-types"
import prisma from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const groceryStores = await prisma.groceryStore.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(groceryStores)
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
    googlePlaceId, name, address, lat, lng, phone, website,
    openingHours, photos, ratingGoogle, storeType, types, status,
  } = body

  // Calculate travel time from accommodation
  let travelTimeMinutes: number | null = null
  let travelDistanceKm: number | null = null

  if (lat != null && lng != null) {
    const accommodations = normalizeAccommodations(trip.accommodation)
    const withCoords = accommodations.find((a) => a.coordinates)
    if (withCoords?.coordinates) {
      try {
        const route = await calculateRoute(
          { lat: withCoords.coordinates.lat, lng: withCoords.coordinates.lng },
          { lat, lng }
        )
        travelTimeMinutes = route.durationMinutes
        travelDistanceKm = route.distanceKm
      } catch {
        // Travel time unavailable
      }
    }
  }

  const resolvedStoreType = storeType || (types ? mapStoreType(types) : null)

  const groceryStore = await prisma.groceryStore.create({
    data: {
      tripId,
      googlePlaceId,
      name,
      address,
      lat,
      lng,
      phone,
      website,
      openingHours: openingHours ?? undefined,
      photos: photos ?? [],
      ratingGoogle,
      storeType: resolvedStoreType,
      travelTimeMinutes,
      travelDistanceKm,
      status: status || "maybe",
      dataSource: "google_places",
      dataLastUpdated: new Date(),
    },
  })

  return NextResponse.json(groceryStore, { status: 201 })
}
