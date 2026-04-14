import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import type { Trip, TripShare } from "@/generated/prisma/client"

import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function verifyTripAccess(tripId: string, userId: string) {
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

export async function requireTripAccess(tripId: string): Promise<
  | { session: Session; trip: Trip & { shares: TripShare[] } }
  | NextResponse
> {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return { session, trip }
}
