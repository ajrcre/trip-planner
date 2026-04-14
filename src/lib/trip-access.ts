import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import type { Trip, TripShare } from "@/generated/prisma/client"

import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { TripRole } from "@/types/sharing"

export type TripAccessResult = {
  trip: Trip & { shares: TripShare[] }
  role: TripRole
}

export async function verifyTripAccess(
  tripId: string,
  userId: string
): Promise<TripAccessResult | null> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { shares: true },
  })

  if (!trip) return null

  if (trip.userId === userId) {
    return { trip, role: "owner" }
  }

  const share = trip.shares.find((s) => s.userId === userId)
  if (share) {
    const role: "editor" | "viewer" = share.role === "editor" ? "editor" : "viewer"
    return { trip, role }
  }

  return null
}

export async function requireTripAccess(tripId: string): Promise<
  | { session: Session; trip: Trip & { shares: TripShare[] }; role: TripRole }
  | NextResponse
> {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await verifyTripAccess(tripId, session.user.id)
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return { session, trip: result.trip, role: result.role }
}
