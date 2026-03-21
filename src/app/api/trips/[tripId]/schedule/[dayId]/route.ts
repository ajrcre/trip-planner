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

async function verifyDayPlan(dayId: string, tripId: string) {
  const dayPlan = await prisma.dayPlan.findUnique({
    where: { id: dayId },
  })

  if (!dayPlan || dayPlan.tripId !== tripId) return null

  return dayPlan
}

// PUT — Replace all activities for a day
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tripId: string; dayId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId, dayId } = await params

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  }

  const dayPlan = await verifyDayPlan(dayId, tripId)
  if (!dayPlan) {
    return NextResponse.json({ error: "Day plan not found" }, { status: 404 })
  }

  const body = await request.json()
  const { activities } = body

  if (!Array.isArray(activities)) {
    return NextResponse.json(
      { error: "activities must be an array" },
      { status: 400 }
    )
  }

  // Delete existing activities and create new ones in a transaction
  await prisma.$transaction([
    prisma.activity.deleteMany({ where: { dayPlanId: dayId } }),
    ...activities.map(
      (activity: {
        sortOrder: number
        timeStart?: string
        timeEnd?: string
        type: string
        notes?: string
        attractionId?: string
        restaurantId?: string
        travelTimeToNextMinutes?: number
      }) =>
        prisma.activity.create({
          data: {
            dayPlanId: dayId,
            sortOrder: activity.sortOrder,
            timeStart: activity.timeStart ?? null,
            timeEnd: activity.timeEnd ?? null,
            type: activity.type,
            notes: activity.notes ?? null,
            attractionId: activity.attractionId ?? null,
            restaurantId: activity.restaurantId ?? null,
            travelTimeToNextMinutes:
              activity.travelTimeToNextMinutes ?? null,
          },
        })
    ),
  ])

  // Return updated day plan with activities
  const updated = await prisma.dayPlan.findUnique({
    where: { id: dayId },
    include: {
      activities: {
        include: {
          attraction: true,
          restaurant: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  return NextResponse.json(updated)
}

// POST — Add a single activity to a day
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string; dayId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId, dayId } = await params

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  }

  const dayPlan = await verifyDayPlan(dayId, tripId)
  if (!dayPlan) {
    return NextResponse.json({ error: "Day plan not found" }, { status: 404 })
  }

  const body = await request.json()
  const {
    sortOrder,
    timeStart,
    timeEnd,
    type,
    notes,
    attractionId,
    restaurantId,
  } = body

  if (typeof sortOrder !== "number" || !type) {
    return NextResponse.json(
      { error: "sortOrder (number) and type are required" },
      { status: 400 }
    )
  }

  const activity = await prisma.activity.create({
    data: {
      dayPlanId: dayId,
      sortOrder,
      timeStart: timeStart ?? null,
      timeEnd: timeEnd ?? null,
      type,
      notes: notes ?? null,
      attractionId: attractionId ?? null,
      restaurantId: restaurantId ?? null,
    },
    include: {
      attraction: true,
      restaurant: true,
    },
  })

  return NextResponse.json(activity, { status: 201 })
}

// DELETE — Remove an activity (activityId passed as query parameter)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string; dayId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId, dayId } = await params

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  }

  const dayPlan = await verifyDayPlan(dayId, tripId)
  if (!dayPlan) {
    return NextResponse.json({ error: "Day plan not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const activityId = url.searchParams.get("activityId")

  if (!activityId) {
    return NextResponse.json(
      { error: "activityId query parameter is required" },
      { status: 400 }
    )
  }

  // Verify activity belongs to this day plan
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  })

  if (!activity || activity.dayPlanId !== dayId) {
    return NextResponse.json(
      { error: "Activity not found" },
      { status: 404 }
    )
  }

  await prisma.activity.delete({ where: { id: activityId } })

  return NextResponse.json({ success: true })
}
