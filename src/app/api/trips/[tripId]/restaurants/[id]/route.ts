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
  const { role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
  })

  if (!restaurant || restaurant.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json()
  const { status, kidFriendly } = body

  const updated = await prisma.restaurant.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(kidFriendly !== undefined && { kidFriendly }),
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
  const { role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
  })

  if (!restaurant || restaurant.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.restaurant.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
