import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { chatWithFunctions } from "@/lib/gemini"
import type { GeminiChatMessage } from "@/lib/gemini"
import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ActionProposal,
  ActionType,
  AddActivityPayload,
  RemoveActivityPayload,
  ReplaceDayPayload,
  PlanFullTripPayload,
  ProposedActivity,
} from "@/types/ai-chat"

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function buildProposal(
  functionName: string,
  args: Record<string, unknown>,
  textBeforeCall: string | null
): ActionProposal {
  const actionType = functionName as ActionType
  const description = textBeforeCall || getFallbackDescription(actionType)

  let payload: ActionProposal["payload"]

  switch (functionName) {
    case "add_activity": {
      payload = {
        actionType: "add_activity",
        dayDate: args.dayDate as string,
        activity: {
          type: (args.type as string) || "custom",
          timeStart: (args.timeStart as string) ?? null,
          timeEnd: (args.timeEnd as string) ?? null,
          notes: (args.notes as string) ?? null,
          attractionId: (args.attractionId as string) ?? null,
          attractionName: (args.attractionName as string) ?? null,
          restaurantId: (args.restaurantId as string) ?? null,
          restaurantName: (args.restaurantName as string) ?? null,
        } satisfies ProposedActivity,
      } satisfies AddActivityPayload
      break
    }
    case "remove_activity": {
      payload = {
        actionType: "remove_activity",
        dayDate: args.dayDate as string,
        activityDescription: args.activityDescription as string,
        activityId: (args.activityId as string) ?? undefined,
      } satisfies RemoveActivityPayload
      break
    }
    case "replace_day_activities": {
      payload = {
        actionType: "replace_day_activities",
        dayDate: args.dayDate as string,
        activities: ((args.activities as Record<string, unknown>[]) || []).map(
          mapToProposedActivity
        ),
      } satisfies ReplaceDayPayload
      break
    }
    case "plan_full_trip": {
      const days = (args.days as Record<string, unknown>[]) || []
      payload = {
        actionType: "plan_full_trip",
        days: days.map((d) => ({
          dayDate: d.dayDate as string,
          activities: (
            (d.activities as Record<string, unknown>[]) || []
          ).map(mapToProposedActivity),
        })),
      } satisfies PlanFullTripPayload
      break
    }
    default:
      throw new Error(`Unknown function: ${functionName}`)
  }

  return {
    id: generateId(),
    actionType,
    status: "pending",
    description,
    payload,
  }
}

function mapToProposedActivity(a: Record<string, unknown>): ProposedActivity {
  return {
    type: (a.type as string) || "custom",
    timeStart: (a.timeStart as string) ?? null,
    timeEnd: (a.timeEnd as string) ?? null,
    notes: (a.notes as string) ?? null,
    attractionId: (a.attractionId as string) ?? null,
    attractionName: (a.attractionName as string) ?? null,
    restaurantId: (a.restaurantId as string) ?? null,
    restaurantName: (a.restaurantName as string) ?? null,
  }
}

function getFallbackDescription(actionType: ActionType): string {
  switch (actionType) {
    case "add_activity":
      return "הוספת פעילות ללו״ז"
    case "remove_activity":
      return "הסרת פעילות מהלו״ז"
    case "replace_day_activities":
      return "עדכון הפעילויות ביום"
    case "plan_full_trip":
      return "תכנון לו״ז מלא לטיול"
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { tripId, messages } = body as ChatRequest

  if (!tripId || !messages?.length) {
    return NextResponse.json(
      { error: "tripId and messages are required" },
      { status: 400 }
    )
  }

  // Fetch trip with related data
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      shares: true,
      attractions: true,
      restaurants: true,
      dayPlans: {
        include: {
          activities: { include: { attraction: true, restaurant: true } },
        },
        orderBy: { date: "asc" },
      },
    },
  })

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  }

  // Verify access
  const isOwner = trip.userId === session.user.id
  const isShared = trip.shares.some((s) => s.userId === session.user.id)
  if (!isOwner && !isShared) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Fetch family profile
  const familyProfile = await prisma.familyProfile.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  })

  // Build context
  const now = new Date()
  const context = {
    destination: trip.destination,
    tripDates: {
      start: trip.startDate.toISOString().split("T")[0],
      end: trip.endDate.toISOString().split("T")[0],
    },
    familyMembers: familyProfile?.members.map((m) => ({
      name: m.name,
      age: Math.floor(
        (now.getTime() - m.dateOfBirth.getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      ),
      role: m.role,
    })),
    savedAttractions: trip.attractions.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      travelTimeMinutes: a.travelTimeMinutes ?? undefined,
    })),
    savedRestaurants: trip.restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      cuisineType: r.cuisineType ?? undefined,
    })),
    currentSchedule: trip.dayPlans.map((dp) => ({
      dayPlanId: dp.id,
      date: dp.date.toISOString().split("T")[0],
      activities: dp.activities.map((a) => ({
        id: a.id,
        type: a.type,
        timeStart: a.timeStart,
        timeEnd: a.timeEnd,
        name:
          a.attraction?.name || a.restaurant?.name || a.notes || a.type,
      })),
    })),
  }

  // Convert messages to Gemini history (all except the last user message)
  const lastUserMessage = messages[messages.length - 1]
  const historyMessages = messages.slice(0, -1)

  const geminiHistory: GeminiChatMessage[] = historyMessages
    .filter((m: ChatMessage) => m.content && m.content.trim() !== "")
    .map((m: ChatMessage) => ({
      role: (m.role === "user" ? "user" : "model") as "user" | "model",
      parts: [{ text: m.content }],
    }))

  try {
    const result = await chatWithFunctions(
      context,
      geminiHistory,
      lastUserMessage.content
    )

    let responseMessage: ChatMessage

    if (result.type === "function_call") {
      const proposal = buildProposal(
        result.functionName,
        result.args,
        result.textBeforeCall
      )

      responseMessage = {
        id: generateId(),
        role: "assistant",
        content: proposal.description,
        actionProposal: proposal,
        timestamp: Date.now(),
      }
    } else {
      responseMessage = {
        id: generateId(),
        role: "assistant",
        content: result.text,
        timestamp: Date.now(),
      }
    }

    const response: ChatResponse = { message: responseMessage }
    return NextResponse.json(response)
  } catch (error) {
    console.error("AI chat error:", error)
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    )
  }
}
