import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"
import { requireTripAccess } from "@/lib/trip-access"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip, role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Return existing token if one already exists
  if (trip.shareToken) {
    return NextResponse.json({
      token: trip.shareToken,
      url: `/shared/${trip.shareToken}`,
    })
  }

  // Generate new share token
  const shareToken = randomUUID()
  await prisma.trip.update({
    where: { id: tripId },
    data: { shareToken },
  })

  return NextResponse.json({
    token: shareToken,
    url: `/shared/${shareToken}`,
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { shareToken: true, userId: true, shares: { select: { userId: true } } },
  })
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const isOwnerGet = trip.userId === session.user.id
  const isSharedGet = trip.shares.some((s) => s.userId === session.user.id)
  if (!isOwnerGet && !isSharedGet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!trip.shareToken) {
    return NextResponse.json({ token: null, url: null })
  }

  return NextResponse.json({
    token: trip.shareToken,
    url: `/shared/${trip.shareToken}`,
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip || trip.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.trip.update({
    where: { id: tripId },
    data: { shareToken: null },
  })

  return NextResponse.json({ success: true })
}
