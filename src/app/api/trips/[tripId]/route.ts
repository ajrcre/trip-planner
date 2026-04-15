import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { geocodeAddress } from "@/lib/google-maps"
import { normalizeAccommodations } from "@/lib/accommodations"
import { syncLogisticsActivities } from "@/lib/sync-logistics"
import { normalizeFlights, normalizeCarRentals } from "@/lib/normalizers"
import { requireTripAccess } from "@/lib/trip-access"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  const fullTrip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      attractions: true,
      restaurants: true,
      groceryStores: true,
      dayPlans: {
        include: { activities: true },
      },
      packingItems: true,
      shoppingItems: true,
    },
  })

  const normalized = {
    ...fullTrip,
    flights: normalizeFlights(fullTrip!.flights),
    carRental: normalizeCarRentals(fullTrip!.carRental),
    role,
  }

  return NextResponse.json(normalized)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { session, role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { name, destination, startDate, endDate, accommodation, flights, carRental } = body

  let enrichedAccommodation = accommodation
  if (accommodation !== undefined) {
    const accommodations = normalizeAccommodations(accommodation)
    enrichedAccommodation = await Promise.all(
      accommodations.map(async (acc) => {
        if (acc.address) {
          const coords = await geocodeAddress(acc.address)
          if (coords) return { ...acc, coordinates: coords }
        }
        return acc
      })
    )
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: {
      ...(name !== undefined && { name }),
      ...(destination !== undefined && { destination }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: new Date(endDate) }),
      ...(enrichedAccommodation !== undefined && { accommodation: enrichedAccommodation }),
      ...(flights !== undefined && { flights }),
      ...(carRental !== undefined && { carRental }),
    },
  })

  // Sync logistics activities if flights or car rental data changed
  if (flights !== undefined || carRental !== undefined) {
    await syncLogisticsActivities(tripId, session.user.id)
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.trip.delete({ where: { id: tripId } })

  return NextResponse.json({ success: true })
}
