import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { geocodeAddress } from "@/lib/google-maps"
import { normalizeAccommodations } from "@/lib/accommodations"
import type { TripListItem } from "@/types/sharing"

export async function GET() {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  // Own trips
  const ownTrips = await prisma.trip.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      destination: true,
      startDate: true,
      endDate: true,
      shares: {
        include: { user: { select: { name: true, image: true } } },
      },
    },
    orderBy: { startDate: "desc" },
  })

  // Shared trips (where current user is a collaborator) — no shares join needed since members: [] for shared trips
  const sharedTripShares = await prisma.tripShare.findMany({
    where: { userId },
    select: {
      role: true,
      trip: {
        select: {
          id: true,
          name: true,
          destination: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  })

  const ownTripItems: TripListItem[] = ownTrips.map((t) => ({
    id: t.id,
    name: t.name,
    destination: t.destination,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    isShared: t.shares.length > 0,
    role: "owner" as const,
    members: t.shares.map((s) => ({ name: s.user.name, image: s.user.image })),
  }))

  const sharedTripItems: TripListItem[] = sharedTripShares.map((s) => ({
    id: s.trip.id,
    name: s.trip.name,
    destination: s.trip.destination,
    startDate: s.trip.startDate.toISOString(),
    endDate: s.trip.endDate.toISOString(),
    isShared: true,
    role: s.role === "editor" ? "editor" : "viewer",
    members: [],
  }))

  // Merge and sort by startDate descending; owner entry wins deduplication via Map (owner is spread first)
  const merged = [...ownTripItems, ...sharedTripItems]
  const deduped = [...new Map(merged.map((item) => [item.id, item])).values()]
  deduped.sort((a, b) => new Date(b.startDate!).getTime() - new Date(a.startDate!).getTime())

  return NextResponse.json(deduped)
}

export async function POST(request: Request) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, destination, startDate, endDate, accommodation, flights, carRental } = body

  if (!name || !destination || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    )
  }

  const accommodations = normalizeAccommodations(accommodation)
  const enrichedAccommodations = await Promise.all(
    accommodations.map(async (acc) => {
      if (acc.address) {
        const coords = await geocodeAddress(acc.address)
        if (coords) return { ...acc, coordinates: coords }
      }
      return acc
    })
  )

  const trip = await prisma.trip.create({
    data: {
      userId: session.user.id,
      name,
      destination,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      accommodation: enrichedAccommodations.length > 0 ? (enrichedAccommodations as any) : undefined,
      flights: flights || undefined,
      carRental: carRental || undefined,
    },
  })

  return NextResponse.json(trip, { status: 201 })
}
