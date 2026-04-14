import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { requireTripAccess } from "@/lib/trip-access"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tripId: string; id: string }> }
) {
  const { tripId, id } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const attraction = await prisma.attraction.findUnique({
    where: { id },
  })

  if (!attraction || attraction.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json()
  const { status, specialNotes, bookingRequired, nearbyRestaurantId } = body

  const updated = await prisma.attraction.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(specialNotes !== undefined && { specialNotes }),
      ...(bookingRequired !== undefined && { bookingRequired }),
      ...(nearbyRestaurantId !== undefined && { nearbyRestaurantId }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; id: string }> }
) {
  const { tripId, id } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const attraction = await prisma.attraction.findUnique({
    where: { id },
  })

  if (!attraction || attraction.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.attraction.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
