import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { syncLogisticsActivities } from "@/lib/sync-logistics"
import { normalizeAccommodations, getAccommodationsForDay } from "@/lib/accommodations"
import { computeDrivingTimesForDay, DrivingTimeFromLodging } from "@/lib/driving-times"

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

  let dayPlans = await prisma.dayPlan.findMany({
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

  // Backfill lodging activities for days that don't have any
  const accommodations = normalizeAccommodations(trip.accommodation)
  let didBackfill = false
  if (accommodations.length > 0) {
    for (const dayPlan of dayPlans) {
      const hasLodging = dayPlan.activities.some((a) => a.type === "lodging")
      if (hasLodging) continue

      const dayDate = dayPlan.date.toISOString().split("T")[0]
      const dayAccs = getAccommodationsForDay(accommodations, dayDate)
      if (dayAccs.length === 0) continue

      const acc = dayAccs[0].accommodation
      const accName = acc.name ?? "לינה"
      didBackfill = true

      if (dayPlan.dayType === "arrival") {
        await prisma.activity.create({
          data: { dayPlanId: dayPlan.id, sortOrder: 900, type: "lodging", timeStart: "21:00", timeEnd: null, notes: accName },
        })
      } else if (dayPlan.dayType === "departure") {
        await prisma.activity.create({
          data: { dayPlanId: dayPlan.id, sortOrder: 0, type: "lodging", timeStart: "09:00", timeEnd: null, notes: accName },
        })
      } else {
        await prisma.activity.create({
          data: { dayPlanId: dayPlan.id, sortOrder: 0, type: "lodging", timeStart: "09:00", timeEnd: null, notes: accName },
        })
        await prisma.activity.create({
          data: { dayPlanId: dayPlan.id, sortOrder: 900, type: "lodging", timeStart: "21:00", timeEnd: null, notes: accName },
        })
      }
    }

    if (didBackfill) {
      dayPlans = await prisma.dayPlan.findMany({
        where: { tripId },
        include: {
          activities: {
            include: { attraction: true, restaurant: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { date: "asc" },
      })
    }
  }

  // Enrich activities with driving times from lodging

  const enrichedDayPlans = await Promise.all(
    dayPlans.map(async (dayPlan) => {
      const dayDate = dayPlan.date.toISOString().split("T")[0]
      const dayAccommodations = getAccommodationsForDay(accommodations, dayDate)
        .map((a) => a.accommodation)

      const enrichedActivities = await Promise.all(
        dayPlan.activities.map(async (activity) => {
          const drivingTimesFromLodging: DrivingTimeFromLodging[] =
            activity.attraction || activity.restaurant
              ? await computeDrivingTimesForDay(dayAccommodations, activity)
              : []
          return { ...activity, drivingTimesFromLodging }
        })
      )

      return { ...dayPlan, activities: enrichedActivities }
    })
  )

  return NextResponse.json(enrichedDayPlans)
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

  // Auto-insert lodging activities
  const accommodationData = normalizeAccommodations(trip.accommodation)
  const createdDayPlans = await prisma.dayPlan.findMany({
    where: { tripId },
    orderBy: { date: "asc" },
  })

  for (const dayPlan of createdDayPlans) {
    const dayDate = dayPlan.date.toISOString().split("T")[0]
    const dayAccs = getAccommodationsForDay(accommodationData, dayDate)
    if (dayAccs.length === 0) continue

    const acc = dayAccs[0].accommodation
    const accName = acc.name ?? "לינה"

    if (dayPlan.dayType === "arrival") {
      await prisma.activity.create({
        data: { dayPlanId: dayPlan.id, sortOrder: 900, type: "lodging", timeStart: "21:00", timeEnd: null, notes: accName },
      })
    } else if (dayPlan.dayType === "departure") {
      await prisma.activity.create({
        data: { dayPlanId: dayPlan.id, sortOrder: 0, type: "lodging", timeStart: "09:00", timeEnd: null, notes: accName },
      })
    } else {
      await prisma.activity.create({
        data: { dayPlanId: dayPlan.id, sortOrder: 0, type: "lodging", timeStart: "09:00", timeEnd: null, notes: accName },
      })
      await prisma.activity.create({
        data: { dayPlanId: dayPlan.id, sortOrder: 900, type: "lodging", timeStart: "21:00", timeEnd: null, notes: accName },
      })
    }
  }

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
