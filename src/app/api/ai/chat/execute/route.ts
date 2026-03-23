import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type {
  ExecuteActionRequest,
  ExecuteActionResponse,
  AddActivityPayload,
  RemoveActivityPayload,
  ReplaceDayPayload,
  PlanFullTripPayload,
  ProposedActivity,
} from "@/types/ai-chat"

// ── Helpers ──

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

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function findDayPlan(tripId: string, dayDate: string) {
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
  })

  const normalized = dayDate.slice(0, 10) // "YYYY-MM-DD"
  return dayPlans.find((dp) => toDateString(dp.date) === normalized) ?? null
}

function toActivityCreateData(
  dayPlanId: string,
  activities: ProposedActivity[]
) {
  return activities.map((a, index) => ({
    dayPlanId,
    sortOrder: index,
    timeStart: a.timeStart ?? null,
    timeEnd: a.timeEnd ?? null,
    type: a.type,
    notes: a.notes ?? null,
    attractionId: a.attractionId ?? null,
    restaurantId: a.restaurantId ?? null,
    travelTimeToNextMinutes: null as number | null,
  }))
}

// ── POST handler ──

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json<ExecuteActionResponse>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )
  }

  let body: ExecuteActionRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ExecuteActionResponse>(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { tripId, proposal } = body

  if (!tripId || !proposal?.payload) {
    return NextResponse.json<ExecuteActionResponse>(
      { success: false, error: "tripId and proposal are required" },
      { status: 400 }
    )
  }

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json<ExecuteActionResponse>(
      { success: false, error: "Trip not found" },
      { status: 404 }
    )
  }

  try {
    const { payload } = proposal

    switch (payload.actionType) {
      // ── Add a single activity ──
      case "add_activity": {
        const { dayDate, activity } = payload as AddActivityPayload
        const dayPlan = await findDayPlan(tripId, dayDate)
        if (!dayPlan) {
          return NextResponse.json<ExecuteActionResponse>(
            { success: false, error: `Day plan not found for ${dayDate}` },
            { status: 404 }
          )
        }

        const maxSortOrder = dayPlan.activities.reduce(
          (max, a) => Math.max(max, a.sortOrder),
          -1
        )

        await prisma.activity.create({
          data: {
            dayPlanId: dayPlan.id,
            sortOrder: maxSortOrder + 1,
            timeStart: activity.timeStart ?? null,
            timeEnd: activity.timeEnd ?? null,
            type: activity.type,
            notes: activity.notes ?? null,
            attractionId: activity.attractionId ?? null,
            restaurantId: activity.restaurantId ?? null,
          },
        })
        break
      }

      // ── Remove an activity ──
      case "remove_activity": {
        const { dayDate, activityDescription, activityId } =
          payload as RemoveActivityPayload
        const dayPlan = await findDayPlan(tripId, dayDate)
        if (!dayPlan) {
          return NextResponse.json<ExecuteActionResponse>(
            { success: false, error: `Day plan not found for ${dayDate}` },
            { status: 404 }
          )
        }

        let targetActivityId: string | undefined = activityId

        if (!targetActivityId) {
          // Fuzzy match by description
          const descLower = activityDescription.toLowerCase()
          const matched = dayPlan.activities.find((a) => {
            const name = (
              a.attraction?.name ??
              a.restaurant?.name ??
              a.notes ??
              a.type ??
              ""
            ).toLowerCase()
            return name.includes(descLower) || descLower.includes(name)
          })

          if (!matched) {
            return NextResponse.json<ExecuteActionResponse>(
              {
                success: false,
                error: `Could not find activity matching "${activityDescription}"`,
              },
              { status: 404 }
            )
          }
          targetActivityId = matched.id
        }

        // Verify activity belongs to this day plan
        const activityToDelete = dayPlan.activities.find(
          (a) => a.id === targetActivityId
        )
        if (!activityToDelete) {
          return NextResponse.json<ExecuteActionResponse>(
            { success: false, error: "Activity not found in day plan" },
            { status: 404 }
          )
        }

        await prisma.activity.delete({ where: { id: targetActivityId } })
        break
      }

      // ── Replace all activities for a day ──
      case "replace_day_activities": {
        const { dayDate, activities } = payload as ReplaceDayPayload
        const dayPlan = await findDayPlan(tripId, dayDate)
        if (!dayPlan) {
          return NextResponse.json<ExecuteActionResponse>(
            { success: false, error: `Day plan not found for ${dayDate}` },
            { status: 404 }
          )
        }

        const createData = toActivityCreateData(dayPlan.id, activities)

        await prisma.$transaction([
          prisma.activity.deleteMany({ where: { dayPlanId: dayPlan.id } }),
          ...createData.map((data) => prisma.activity.create({ data })),
        ])
        break
      }

      // ── Plan full trip ──
      case "plan_full_trip": {
        const { days } = payload as PlanFullTripPayload

        for (const day of days) {
          const dayPlan = await findDayPlan(tripId, day.dayDate)
          if (!dayPlan) continue // skip days that don't exist

          const createData = toActivityCreateData(dayPlan.id, day.activities)

          await prisma.$transaction([
            prisma.activity.deleteMany({ where: { dayPlanId: dayPlan.id } }),
            ...createData.map((data) => prisma.activity.create({ data })),
          ])
        }
        break
      }

      default:
        return NextResponse.json<ExecuteActionResponse>(
          {
            success: false,
            error: `Unknown action type: ${(payload as { actionType: string }).actionType}`,
          },
          { status: 400 }
        )
    }

    return NextResponse.json<ExecuteActionResponse>({ success: true })
  } catch (error) {
    console.error("[ai/chat/execute] Error executing action:", error)
    return NextResponse.json<ExecuteActionResponse>(
      { success: false, error: "Failed to execute action" },
      { status: 500 }
    )
  }
}
