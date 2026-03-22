import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { syncLogisticsActivities } from "@/lib/sync-logistics"

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const dayPlans = await prisma.dayPlan.findMany({
    where: { tripId },
    include: {
      activities: {
        include: {
          attraction: true,
          restaurant: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { date: "asc" },
  })

  return NextResponse.json(dayPlans)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Check if day plans already exist
  const existing = await prisma.dayPlan.findMany({
    where: { tripId },
    include: {
      activities: {
        include: {
          attraction: true,
          restaurant: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { date: "asc" },
  })

  if (existing.length > 0) {
    return NextResponse.json(existing)
  }

  // Generate day plans for each day between startDate and endDate
  const start = new Date(trip.startDate)
  const end = new Date(trip.endDate)
  const days: { date: Date; dayType: string }[] = []

  for (
    let d = new Date(start);
    d <= end;
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const isFirst = d.getTime() === start.getTime()
    const isLast = d.getTime() === end.getTime()

    let dayType = "full_day"
    if (isFirst) dayType = "arrival"
    else if (isLast) dayType = "departure"

    days.push({ date: new Date(d), dayType })
  }

  // Create all day plans in a transaction
  await prisma.$transaction(
    days.map((day) =>
      prisma.dayPlan.create({
        data: {
          tripId,
          date: day.date,
          dayType: day.dayType,
        },
      })
    )
  )

  // Sync logistics activities from flight/car data
  await syncLogisticsActivities(tripId, session.user.id)

  // Fetch created plans with relations
  const dayPlans = await prisma.dayPlan.findMany({
    where: { tripId },
    include: {
      activities: {
        include: {
          attraction: true,
          restaurant: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { date: "asc" },
  })

  return NextResponse.json(dayPlans, { status: 201 })
}
