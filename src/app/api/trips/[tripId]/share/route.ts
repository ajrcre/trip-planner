import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const trip = await prisma.trip.findUnique({ where: { id: tripId } })
  if (!trip || trip.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
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
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { shareToken: true, userId: true },
  })
  if (!trip || trip.userId !== session.user.id) {
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
