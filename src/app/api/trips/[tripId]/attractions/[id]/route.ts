import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tripId: string; id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId, id } = await params

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const attraction = await prisma.attraction.findUnique({
    where: { id },
  })

  if (!attraction || attraction.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json()
  const { status, specialNotes, bookingRequired } = body

  const updated = await prisma.attraction.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(specialNotes !== undefined && { specialNotes }),
      ...(bookingRequired !== undefined && { bookingRequired }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId, id } = await params

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const attraction = await prisma.attraction.findUnique({
    where: { id },
  })

  if (!attraction || attraction.tripId !== tripId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.attraction.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
