import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { requireTripAccess } from "@/lib/trip-access"
import { normalizeAccommodations } from "@/lib/accommodations"
import { normalizeCarRentals, normalizeFlights } from "@/lib/normalizers"
import {
  buildTravelLegForSave,
  placeMapsFromTrip,
} from "@/lib/travel-leg-resolve"
import { supportsAlternatives } from "@/lib/activity-alternatives"
import type { TravelEndpointRef } from "@/types/travel-leg"

async function verifyDayPlan(dayId: string, tripId: string) {
  const dayPlan = await prisma.dayPlan.findUnique({
    where: { id: dayId },
  })

  if (!dayPlan || dayPlan.tripId !== tripId) return null

  return dayPlan
}

interface AlternativePayload {
  priority: number
  attractionId?: string | null
  restaurantId?: string | null
  groceryStoreId?: string | null
  notes?: string | null
}

interface ActivityPayload {
  sortOrder: number
  timeStart?: string | null
  timeEnd?: string | null
  type: string
  notes?: string | null
  attractionId?: string | null
  restaurantId?: string | null
  groceryStoreId?: string | null
  restAccommodationIndex?: number | null
  travelTimeToNextMinutes?: number | null
  travelLeg?: {
    origin: TravelEndpointRef
    destination: TravelEndpointRef
  } | null
  alternatives?: AlternativePayload[] | null
}

const activityInclude = {
  attraction: true,
  restaurant: true,
  groceryStore: true,
  alternatives: {
    include: {
      attraction: true,
      restaurant: true,
      groceryStore: true,
    },
    orderBy: { priority: "asc" as const },
  },
} as const

// PUT — Replace all activities for a day
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tripId: string; dayId: string }> }
) {
  const { tripId, dayId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      attractions: true,
      restaurants: true,
      groceryStores: true,
    },
  })

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  }

  const accommodations = normalizeAccommodations(trip.accommodation)
  const flights = normalizeFlights(trip.flights)
  const carRentals = normalizeCarRentals(trip.carRental)
  const places = placeMapsFromTrip(
    trip.attractions.map((a) => ({
      id: a.id,
      name: a.name,
      lat: a.lat,
      lng: a.lng,
    })),
    trip.restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
    })),
    trip.groceryStores.map((g) => ({
      id: g.id,
      name: g.name,
      lat: g.lat,
      lng: g.lng,
    }))
  )

  const prepared: Array<{
    payload: ActivityPayload
    travelLegJson: unknown | null
  }> = []

  try {
    for (const raw of activities as ActivityPayload[]) {
      if (raw.type === "rest" && raw.restAccommodationIndex != null) {
        const i = raw.restAccommodationIndex
        if (
          !Number.isInteger(i) ||
          i < 0 ||
          i >= accommodations.length
        ) {
          return NextResponse.json(
            {
              error:
                "מנוחה: בחרו לינה תקינה מהרשימה (אינדקס מחוץ לטווח)",
            },
            { status: 400 }
          )
        }
      }
      let travelLegJson: unknown | null = null
      if (
        raw.type === "travel" &&
        raw.travelLeg?.origin &&
        raw.travelLeg?.destination
      ) {
        const built = await buildTravelLegForSave(
          raw.travelLeg.origin,
          raw.travelLeg.destination,
          places,
          accommodations,
          flights,
          carRentals
        )
        if (!built) {
          return NextResponse.json(
            {
              error:
                "לא ניתן לחשב את מסלול הנסיעה — בדקו שיש לכל נקודה מיקום או כתובת",
            },
            { status: 400 }
          )
        }
        travelLegJson = built
      }
      prepared.push({ payload: raw, travelLegJson })
    }

    await prisma.$transaction(async (tx) => {
      // Delete existing activities (cascade deletes their alternatives)
      await tx.activity.deleteMany({ where: { dayPlanId: dayId } })

      // Create each activity and its alternatives
      for (const { payload: activity, travelLegJson } of prepared) {
        const created = await tx.activity.create({
          data: {
            dayPlanId: dayId,
            sortOrder: activity.sortOrder,
            timeStart: activity.timeStart ?? null,
            timeEnd: activity.timeEnd ?? null,
            type: activity.type,
            notes: activity.notes ?? null,
            attractionId: activity.attractionId ?? null,
            restaurantId: activity.restaurantId ?? null,
            groceryStoreId: activity.groceryStoreId ?? null,
            restAccommodationIndex:
              activity.type === "rest"
                ? activity.restAccommodationIndex ?? null
                : null,
            travelTimeToNextMinutes: activity.travelTimeToNextMinutes ?? null,
            travelLeg: travelLegJson ?? undefined,
          },
        })

        const alts = activity.alternatives
        if (alts && alts.length > 0 && supportsAlternatives(activity.type)) {
          // Validate place-type consistency
          for (const alt of alts) {
            if (activity.type === "attraction" && !alt.attractionId) {
              throw new Error("חלופה לאטרקציה חייבת לכלול attractionId")
            }
            if (activity.type === "meal" && !alt.restaurantId) {
              throw new Error("חלופה לארוחה חייבת לכלול restaurantId")
            }
            if (activity.type === "grocery" && !alt.groceryStoreId) {
              throw new Error("חלופה לקניות חייבת לכלול groceryStoreId")
            }
          }

          await tx.activityAlternative.createMany({
            data: alts.map((alt) => ({
              activityId: created.id,
              priority: alt.priority,
              notes: alt.notes ?? null,
              attractionId: alt.attractionId ?? null,
              restaurantId: alt.restaurantId ?? null,
              groceryStoreId: alt.groceryStoreId ?? null,
            })),
          })
        }
      }
    })
  } catch (err) {
    console.error("Schedule day PUT failed:", err)
    const msg = err instanceof Error ? err.message : String(err)
    const isMissingColumn =
      msg.includes("travelLeg") ||
      msg.includes("column") ||
      msg.includes("does not exist")
    return NextResponse.json(
      {
        error: isMissingColumn
          ? "מסד הנתונים לא מעודכן — הריצו prisma migrate והפעילו מחדש את השרת"
          : "שגיאה בשמירת הלו״ז",
      },
      { status: 500 }
    )
  }

  const updated = await prisma.dayPlan.findUnique({
    where: { id: dayId },
    include: {
      activities: {
        include: activityInclude,
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
  const { tripId, dayId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
    groceryStoreId,
    restAccommodationIndex,
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
      groceryStoreId: groceryStoreId ?? null,
      restAccommodationIndex:
        typeof restAccommodationIndex === "number"
          ? restAccommodationIndex
          : restAccommodationIndex === null
            ? null
            : undefined,
    },
    include: activityInclude,
  })

  return NextResponse.json(activity, { status: 201 })
}

// DELETE — Remove an activity (activityId passed as query parameter)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string; dayId: string }> }
) {
  const { tripId, dayId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
