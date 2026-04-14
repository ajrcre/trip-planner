import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { requireTripAccess } from "@/lib/trip-access"
import type {
  ExecuteActionRequest,
  ExecuteActionResponse,
  AddActivityPayload,
  RemoveActivityPayload,
  ReplaceDayPayload,
  PlanFullTripPayload,
  ProposedActivity,
} from "@/types/ai-chat"
import { resortActivitiesByTime } from "@/lib/sync-logistics"

// ── Helpers ──

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
  // Sort by timeStart before assigning sortOrder so activities are chronological
  const sorted = [...activities].sort((a, b) => {
    if (!a.timeStart && !b.timeStart) return 0
    if (!a.timeStart) return 1
    if (!b.timeStart) return -1
    return a.timeStart.localeCompare(b.timeStart)
  })

  return sorted.map((a, index) => ({
    dayPlanId,
    sortOrder: index,
    timeStart: a.timeStart ?? null,
    timeEnd: a.timeEnd ?? null,
    type: a.type,
    notes: a.notes ?? null,
    attractionId: a.attractionId ?? null,
    restaurantId: a.restaurantId ?? null,
    restAccommodationIndex: a.restAccommodationIndex ?? null,
    travelTimeToNextMinutes: null as number | null,
  }))
}

// ── POST handler ──

export async function POST(request: Request) {
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

  const session = await getAuthSession()
  if (session?.user) {
    if (!checkRateLimit(session.user.email ?? session.user.id).allowed) {
      return NextResponse.json<ExecuteActionResponse>(
        { success: false, error: "Too many requests" },
        { status: 429 }
      )
    }
  }

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role === "viewer") {
    return NextResponse.json<ExecuteActionResponse>(
      { success: false, error: "Forbidden" },
      { status: 403 }
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
            restAccommodationIndex: activity.restAccommodationIndex ?? null,
          },
        })

        // Re-sort so the new activity appears in chronological order
        await resortActivitiesByTime([dayPlan.id])
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
