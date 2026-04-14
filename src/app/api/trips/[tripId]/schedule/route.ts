import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { syncLogisticsActivities } from "@/lib/sync-logistics"
import { normalizeAccommodations, getAccommodationsForDay } from "@/lib/accommodations"
import { computeDrivingTimesForDay, DrivingTimeFromLodging } from "@/lib/driving-times"
import { requireTripAccess } from "@/lib/trip-access"
import { getPlaceDetails } from "@/lib/google-maps"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip } = result

  let dayPlans = await prisma.dayPlan.findMany({
    where: { tripId },
    include: {
      activities: {
        include: {
          attraction: true,
          restaurant: true,
          groceryStore: true,
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
            include: { attraction: true, restaurant: true, groceryStore: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { date: "asc" },
      })
    }
  }

  // Backfill opening hours for places that have a googlePlaceId but no openingHours
  const placesToBackfill: { id: string; googlePlaceId: string; model: "attraction" | "restaurant" | "groceryStore" }[] = []

  for (const dp of dayPlans) {
    for (const activity of dp.activities) {
      for (const model of ["attraction", "restaurant", "groceryStore"] as const) {
        const place = activity[model]
        if (place && place.googlePlaceId && !place.openingHours) {
          // Avoid duplicates if the same place appears in multiple activities
          if (!placesToBackfill.some((p) => p.id === place.id && p.model === model)) {
            placesToBackfill.push({ id: place.id, googlePlaceId: place.googlePlaceId, model })
          }
        }
      }
    }
  }

  if (placesToBackfill.length > 0) {
    const backfillResults = await Promise.allSettled(
      placesToBackfill.map(async ({ id, googlePlaceId, model }) => {
        const details = await getPlaceDetails(
          googlePlaceId,
          "regularOpeningHours"
        )
        const hours = details.regularOpeningHours?.weekdayDescriptions as string[] | undefined ?? null
        if (!hours) return

        const prismaModel = model === "groceryStore" ? prisma.groceryStore : prisma[model]
        await (prismaModel as typeof prisma.attraction).update({
          where: { id },
          data: { openingHours: hours },
        })
      })
    )

    // If any were backfilled, re-fetch day plans so the response includes the new data
    const didBackfillHours = backfillResults.some((r) => r.status === "fulfilled")
    if (didBackfillHours) {
      dayPlans = await prisma.dayPlan.findMany({
        where: { tripId },
        include: {
          activities: {
            include: { attraction: true, restaurant: true, groceryStore: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { date: "asc" },
      })
    }
  }

  // Deduplicate activities within each day (can happen from concurrent backfill requests)
  const duplicateIds: string[] = []
  for (const dayPlan of dayPlans) {
    const seen = new Set<string>()
    for (const activity of dayPlan.activities) {
      const key = [
        activity.type,
        activity.timeStart ?? "",
        activity.timeEnd ?? "",
        activity.attractionId ?? "",
        activity.restaurantId ?? "",
        activity.groceryStoreId ?? "",
        activity.notes ?? "",
        activity.sortOrder,
      ].join("|")
      if (seen.has(key)) {
        duplicateIds.push(activity.id)
      } else {
        seen.add(key)
      }
    }
  }

  if (duplicateIds.length > 0) {
    await prisma.activity.deleteMany({ where: { id: { in: duplicateIds } } })
    // Remove from in-memory data
    for (const dayPlan of dayPlans) {
      (dayPlan as { activities: typeof dayPlan.activities }).activities =
        dayPlan.activities.filter((a) => !duplicateIds.includes(a.id))
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
            activity.attraction || activity.restaurant || activity.groceryStore
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
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { session, trip, role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Check if day plans already exist
  const existing = await prisma.dayPlan.findMany({
    where: { tripId },
    include: {
      activities: {
        include: {
          attraction: true,
          restaurant: true,
          groceryStore: true,
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
          groceryStore: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { date: "asc" },
  })

  return NextResponse.json(dayPlans, { status: 201 })
}
