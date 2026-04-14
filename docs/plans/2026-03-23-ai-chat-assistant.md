# AI Chat Assistant with Function Calling — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-question AI assistant with a slide-out chat drawer that supports multi-turn conversation and can directly modify the trip itinerary via Gemini function calling, with user approval before each change.

**Architecture:** The frontend sends the full conversation history to a new `/api/ai/chat` endpoint on each turn. The backend passes it to Gemini configured with function declarations (`add_activity`, `remove_activity`, `replace_day_activities`, `plan_full_trip`). When Gemini returns a function call, the backend translates it into a structured "action proposal" sent to the frontend. The frontend renders a visual card showing the proposed change. On user approval, the frontend calls a `/api/ai/chat/execute` endpoint that performs the actual DB mutation via the existing schedule APIs.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, `@google/generative-ai` 0.24.x (Gemini function calling), Prisma ORM.

---

## Task 1: Shared Types for Chat & Actions

**Files:**
- Create: `src/types/ai-chat.ts`

**Step 1: Create the shared types file**

```typescript
// src/types/ai-chat.ts

// ── Chat message types ──

export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  /** If the assistant proposes an action, this is attached to the message */
  actionProposal?: ActionProposal
  timestamp: number
}

// ── Action proposal types ──

export type ActionType =
  | "add_activity"
  | "remove_activity"
  | "replace_day_activities"
  | "plan_full_trip"

export type ActionStatus = "pending" | "approved" | "rejected"

export interface ProposedActivity {
  type: string // "attraction" | "meal" | "rest" | "travel" | "custom" | "lodging"
  timeStart: string | null
  timeEnd: string | null
  notes: string | null
  attractionId: string | null
  attractionName: string | null
  restaurantId: string | null
  restaurantName: string | null
}

export interface ActionProposal {
  id: string
  actionType: ActionType
  status: ActionStatus
  /** Human-readable summary in Hebrew */
  description: string
  /** The raw function call args from Gemini */
  payload: AddActivityPayload | RemoveActivityPayload | ReplaceDayPayload | PlanFullTripPayload
}

export interface AddActivityPayload {
  actionType: "add_activity"
  dayDate: string // "YYYY-MM-DD"
  activity: ProposedActivity
}

export interface RemoveActivityPayload {
  actionType: "remove_activity"
  dayDate: string
  activityDescription: string // Gemini describes which to remove
  activityId?: string // resolved by backend if possible
}

export interface ReplaceDayPayload {
  actionType: "replace_day_activities"
  dayDate: string
  activities: ProposedActivity[]
}

export interface PlanFullTripPayload {
  actionType: "plan_full_trip"
  days: Array<{
    dayDate: string
    activities: ProposedActivity[]
  }>
}

// ── API request/response types ──

export interface ChatRequest {
  tripId: string
  messages: ChatMessage[]
}

export interface ChatResponse {
  message: ChatMessage
}

export interface ExecuteActionRequest {
  tripId: string
  proposal: ActionProposal
}

export interface ExecuteActionResponse {
  success: boolean
  error?: string
}
```

**Step 2: Commit**

```bash
git add src/types/ai-chat.ts
git commit -m "feat(ai): add shared types for chat messages and action proposals"
```

---

## Task 2: Gemini Function Declarations & Chat Function

**Files:**
- Modify: `src/lib/gemini.ts` (add new function at bottom, keep existing functions untouched)

**Step 1: Add function declarations and chat function to gemini.ts**

Add the following at the bottom of `src/lib/gemini.ts`:

```typescript
// ── AI Chat with Function Calling ──────────────────────────────────

import type {
  AddActivityPayload,
  RemoveActivityPayload,
  ReplaceDayPayload,
  PlanFullTripPayload,
  ProposedActivity,
} from "@/types/ai-chat"

const CHAT_SYSTEM_PROMPT = `אתה עוזר חכם לתכנון טיולים משפחתיים. אתה מדבר בעברית.

כללים חשובים:
- אל תמציא נתונים עובדתיים כמו שעות פתיחה, מחירים או זמני נסיעה.
- כשאתה ממליץ, התבסס על האטרקציות והמסעדות שכבר נשמרו בטיול.
- התחשב בגילאי הילדים ובהעדפות המשפחה.
- כשמבקשים ממך לשנות את הלו"ז, השתמש בפונקציות הזמינות לך.
- כשאתה מציע שינוי, תאר בעברית מה אתה הולך לעשות לפני שתקרא לפונקציה.
- אם המשתמש מבקש לתכנן את כל הטיול, השתמש ב-plan_full_trip.
- אם המשתמש מבקש להוסיף פעילות ליום מסוים, השתמש ב-add_activity.
- אם המשתמש מבקש להסיר פעילות, השתמש ב-remove_activity.
- אם המשתמש מבקש לשנות לו"ז של יום שלם, השתמש ב-replace_day_activities.
- עבור attractionId ו-restaurantId, השתמש ב-ID-ים מרשימת האטרקציות/מסעדות שניתנו לך בהקשר.
- עבור type, השתמש באחד מ: "attraction", "meal", "rest", "travel", "custom", "lodging".`

const chatFunctionDeclarations = [
  {
    name: "add_activity",
    description: "Add a single activity to a specific day in the trip schedule. Use when the user asks to add an attraction, meal, or other activity to a day.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        dayDate: {
          type: "STRING" as const,
          description: "The date to add the activity to, in YYYY-MM-DD format",
        },
        type: {
          type: "STRING" as const,
          enum: ["attraction", "meal", "rest", "travel", "custom", "lodging"],
          description: "The type of activity",
        },
        timeStart: {
          type: "STRING" as const,
          description: "Start time in HH:MM format, or null if unknown",
        },
        timeEnd: {
          type: "STRING" as const,
          description: "End time in HH:MM format, or null if unknown",
        },
        notes: {
          type: "STRING" as const,
          description: "Additional notes for the activity",
        },
        attractionId: {
          type: "STRING" as const,
          description: "The ID of the attraction from the saved list, if type is attraction",
        },
        attractionName: {
          type: "STRING" as const,
          description: "Name of the attraction for display",
        },
        restaurantId: {
          type: "STRING" as const,
          description: "The ID of the restaurant from the saved list, if type is meal",
        },
        restaurantName: {
          type: "STRING" as const,
          description: "Name of the restaurant for display",
        },
      },
      required: ["dayDate", "type"],
    },
  },
  {
    name: "remove_activity",
    description: "Remove an activity from a specific day. Use when the user asks to remove or delete something from the schedule.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        dayDate: {
          type: "STRING" as const,
          description: "The date of the activity to remove, in YYYY-MM-DD format",
        },
        activityDescription: {
          type: "STRING" as const,
          description: "Description of which activity to remove (name or type)",
        },
        activityId: {
          type: "STRING" as const,
          description: "The exact activity ID if known from context",
        },
      },
      required: ["dayDate", "activityDescription"],
    },
  },
  {
    name: "replace_day_activities",
    description: "Replace all activities for a single day with a new set. Use when the user asks to reorganize or replan a specific day.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        dayDate: {
          type: "STRING" as const,
          description: "The date to replace activities for, in YYYY-MM-DD format",
        },
        activities: {
          type: "ARRAY" as const,
          items: {
            type: "OBJECT" as const,
            properties: {
              type: { type: "STRING" as const, enum: ["attraction", "meal", "rest", "travel", "custom", "lodging"] },
              timeStart: { type: "STRING" as const },
              timeEnd: { type: "STRING" as const },
              notes: { type: "STRING" as const },
              attractionId: { type: "STRING" as const },
              attractionName: { type: "STRING" as const },
              restaurantId: { type: "STRING" as const },
              restaurantName: { type: "STRING" as const },
            },
            required: ["type"],
          },
          description: "The new list of activities for this day",
        },
      },
      required: ["dayDate", "activities"],
    },
  },
  {
    name: "plan_full_trip",
    description: "Plan the entire trip by filling in activities for all days based on saved attractions and restaurants. Use when the user asks to plan the whole trip, fill in the schedule, or create an itinerary from scratch.",
    parameters: {
      type: "OBJECT" as const,
      properties: {
        days: {
          type: "ARRAY" as const,
          items: {
            type: "OBJECT" as const,
            properties: {
              dayDate: { type: "STRING" as const, description: "Date in YYYY-MM-DD format" },
              activities: {
                type: "ARRAY" as const,
                items: {
                  type: "OBJECT" as const,
                  properties: {
                    type: { type: "STRING" as const, enum: ["attraction", "meal", "rest", "travel", "custom", "lodging"] },
                    timeStart: { type: "STRING" as const },
                    timeEnd: { type: "STRING" as const },
                    notes: { type: "STRING" as const },
                    attractionId: { type: "STRING" as const },
                    attractionName: { type: "STRING" as const },
                    restaurantId: { type: "STRING" as const },
                    restaurantName: { type: "STRING" as const },
                  },
                  required: ["type"],
                },
              },
            },
            required: ["dayDate", "activities"],
          },
          description: "Array of days, each with a date and list of activities",
        },
      },
      required: ["days"],
    },
  },
]

export interface GeminiChatMessage {
  role: "user" | "model"
  parts: Array<{ text: string }>
}

export interface GeminiFunctionCallResult {
  type: "function_call"
  functionName: string
  args: Record<string, unknown>
  textBeforeCall: string | null
}

export interface GeminiTextResult {
  type: "text"
  text: string
}

export type GeminiChatResult = GeminiFunctionCallResult | GeminiTextResult

export async function chatWithFunctions(
  context: {
    destination: string
    tripDates: { start: string; end: string }
    familyMembers?: { name: string; age: number; role: string }[]
    savedAttractions?: { id: string; name: string; status: string; travelTimeMinutes?: number }[]
    savedRestaurants?: { id: string; name: string; cuisineType?: string }[]
    currentSchedule?: {
      dayPlanId: string
      date: string
      activities: Array<{
        id: string
        type: string
        timeStart: string | null
        timeEnd: string | null
        name: string
      }>
    }[]
  },
  history: GeminiChatMessage[],
  userMessage: string
): Promise<GeminiChatResult> {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-pro-preview",
    systemInstruction: CHAT_SYSTEM_PROMPT,
    tools: [{ functionDeclarations: chatFunctionDeclarations }],
  })

  // Build context message (only included with the first user message)
  const contextPrefix =
    history.length === 0
      ? buildChatContext(context)
      : ""

  const chat = model.startChat({ history })

  const fullMessage = contextPrefix
    ? `${contextPrefix}\n\nשאלת/בקשת המשתמש: ${userMessage}`
    : userMessage

  const result = await chat.sendMessage(fullMessage)
  const response = result.response

  // Check for function calls
  const candidate = response.candidates?.[0]
  if (candidate?.content?.parts) {
    let textBeforeCall: string | null = null
    for (const part of candidate.content.parts) {
      if ("text" in part && part.text) {
        textBeforeCall = part.text
      }
      if ("functionCall" in part && part.functionCall) {
        return {
          type: "function_call",
          functionName: part.functionCall.name,
          args: part.functionCall.args as Record<string, unknown>,
          textBeforeCall,
        }
      }
    }
  }

  // Plain text response
  return {
    type: "text",
    text: response.text(),
  }
}

function buildChatContext(context: {
  destination: string
  tripDates: { start: string; end: string }
  familyMembers?: { name: string; age: number; role: string }[]
  savedAttractions?: { id: string; name: string; status: string; travelTimeMinutes?: number }[]
  savedRestaurants?: { id: string; name: string; cuisineType?: string }[]
  currentSchedule?: {
    dayPlanId: string
    date: string
    activities: Array<{ id: string; type: string; timeStart: string | null; timeEnd: string | null; name: string }>
  }[]
}): string {
  const lines = [
    `מידע על הטיול:`,
    `- יעד: ${context.destination}`,
    `- תאריכים: ${context.tripDates.start} עד ${context.tripDates.end}`,
  ]

  if (context.familyMembers?.length) {
    lines.push(
      `- בני משפחה: ${context.familyMembers.map((m) => `${m.name} (${m.role}, גיל ${m.age})`).join(", ")}`
    )
  }

  if (context.savedAttractions?.length) {
    lines.push(`- אטרקציות שנשמרו (השתמש ב-ID כשקוראים לפונקציות):`)
    for (const a of context.savedAttractions) {
      lines.push(`  • ${a.name} [id: ${a.id}] (סטטוס: ${a.status}${a.travelTimeMinutes ? `, ${a.travelTimeMinutes} דק'` : ""})`)
    }
  }

  if (context.savedRestaurants?.length) {
    lines.push(`- מסעדות שנשמרו:`)
    for (const r of context.savedRestaurants) {
      lines.push(`  • ${r.name} [id: ${r.id}]${r.cuisineType ? ` (${r.cuisineType})` : ""}`)
    }
  }

  if (context.currentSchedule?.length) {
    lines.push(`- לו"ז נוכחי:`)
    for (const day of context.currentSchedule) {
      const acts = day.activities.length
        ? day.activities
            .map((a) => `${a.name}${a.timeStart ? ` (${a.timeStart})` : ""} [activityId: ${a.id}]`)
            .join(", ")
        : "ריק"
      lines.push(`  • ${day.date} [dayPlanId: ${day.dayPlanId}]: ${acts}`)
    }
  }

  return lines.join("\n")
}
```

**Step 2: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat(ai): add Gemini chat function with tool declarations for schedule mutations"
```

---

## Task 3: Chat API Endpoint (`/api/ai/chat`)

**Files:**
- Create: `src/app/api/ai/chat/route.ts`

**Step 1: Create the chat endpoint**

```typescript
// src/app/api/ai/chat/route.ts

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { chatWithFunctions } from "@/lib/gemini"
import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ActionProposal,
  AddActivityPayload,
  RemoveActivityPayload,
  ReplaceDayPayload,
  PlanFullTripPayload,
  ProposedActivity,
} from "@/types/ai-chat"
import type { GeminiChatMessage } from "@/lib/gemini"

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Convert our ChatMessage[] to Gemini's history format */
function toGeminiHistory(messages: ChatMessage[]): GeminiChatMessage[] {
  // Only include messages before the last user message (which we send separately)
  // Filter out messages with action proposals (they don't map cleanly to Gemini history)
  const history: GeminiChatMessage[] = []

  for (const msg of messages) {
    if (msg.role === "user") {
      history.push({ role: "user", parts: [{ text: msg.content }] })
    } else if (msg.role === "assistant" && msg.content) {
      history.push({ role: "model", parts: [{ text: msg.content }] })
    }
  }

  return history
}

/** Parse Gemini function call args into typed payloads */
function buildProposal(
  functionName: string,
  args: Record<string, unknown>,
  textBeforeCall: string | null
): ActionProposal {
  const id = generateId()

  switch (functionName) {
    case "add_activity": {
      const activity: ProposedActivity = {
        type: (args.type as string) || "custom",
        timeStart: (args.timeStart as string) || null,
        timeEnd: (args.timeEnd as string) || null,
        notes: (args.notes as string) || null,
        attractionId: (args.attractionId as string) || null,
        attractionName: (args.attractionName as string) || null,
        restaurantId: (args.restaurantId as string) || null,
        restaurantName: (args.restaurantName as string) || null,
      }
      const payload: AddActivityPayload = {
        actionType: "add_activity",
        dayDate: args.dayDate as string,
        activity,
      }
      return {
        id,
        actionType: "add_activity",
        status: "pending",
        description: textBeforeCall || `הוספת ${activity.attractionName || activity.restaurantName || activity.type} ליום ${args.dayDate}`,
        payload,
      }
    }

    case "remove_activity": {
      const payload: RemoveActivityPayload = {
        actionType: "remove_activity",
        dayDate: args.dayDate as string,
        activityDescription: args.activityDescription as string,
        activityId: (args.activityId as string) || undefined,
      }
      return {
        id,
        actionType: "remove_activity",
        status: "pending",
        description: textBeforeCall || `הסרת ${args.activityDescription} מיום ${args.dayDate}`,
        payload,
      }
    }

    case "replace_day_activities": {
      const rawActivities = (args.activities as Array<Record<string, unknown>>) || []
      const activities: ProposedActivity[] = rawActivities.map((a) => ({
        type: (a.type as string) || "custom",
        timeStart: (a.timeStart as string) || null,
        timeEnd: (a.timeEnd as string) || null,
        notes: (a.notes as string) || null,
        attractionId: (a.attractionId as string) || null,
        attractionName: (a.attractionName as string) || null,
        restaurantId: (a.restaurantId as string) || null,
        restaurantName: (a.restaurantName as string) || null,
      }))
      const payload: ReplaceDayPayload = {
        actionType: "replace_day_activities",
        dayDate: args.dayDate as string,
        activities,
      }
      return {
        id,
        actionType: "replace_day_activities",
        status: "pending",
        description: textBeforeCall || `עדכון לו"ז ליום ${args.dayDate} (${activities.length} פעילויות)`,
        payload,
      }
    }

    case "plan_full_trip": {
      const rawDays = (args.days as Array<Record<string, unknown>>) || []
      const days = rawDays.map((d) => ({
        dayDate: d.dayDate as string,
        activities: ((d.activities as Array<Record<string, unknown>>) || []).map((a) => ({
          type: (a.type as string) || "custom",
          timeStart: (a.timeStart as string) || null,
          timeEnd: (a.timeEnd as string) || null,
          notes: (a.notes as string) || null,
          attractionId: (a.attractionId as string) || null,
          attractionName: (a.attractionName as string) || null,
          restaurantId: (a.restaurantId as string) || null,
          restaurantName: (a.restaurantName as string) || null,
        })),
      }))
      const payload: PlanFullTripPayload = {
        actionType: "plan_full_trip",
        days,
      }
      const totalActivities = days.reduce((sum, d) => sum + d.activities.length, 0)
      return {
        id,
        actionType: "plan_full_trip",
        status: "pending",
        description: textBeforeCall || `תכנון טיול מלא: ${days.length} ימים, ${totalActivities} פעילויות`,
        payload,
      }
    }

    default:
      throw new Error(`Unknown function: ${functionName}`)
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as ChatRequest
  const { tripId, messages } = body

  if (!tripId || !messages?.length) {
    return NextResponse.json(
      { error: "tripId and messages are required" },
      { status: 400 }
    )
  }

  // Get the last user message
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
  if (!lastUserMessage) {
    return NextResponse.json({ error: "No user message found" }, { status: 400 })
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
          activities: {
            include: { attraction: true, restaurant: true },
            orderBy: { sortOrder: "asc" },
          },
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

  // Fetch family members
  const familyProfile = await prisma.familyProfile.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  })

  const now = new Date()
  const familyMembers = familyProfile?.members.map((m) => ({
    name: m.name,
    age: Math.floor(
      (now.getTime() - m.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    ),
    role: m.role,
  }))

  // Build context
  const context = {
    destination: trip.destination,
    tripDates: {
      start: trip.startDate.toISOString().split("T")[0],
      end: trip.endDate.toISOString().split("T")[0],
    },
    familyMembers,
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
        name: a.attraction?.name || a.restaurant?.name || a.notes || a.type,
      })),
    })),
  }

  // Convert to Gemini history (all messages EXCEPT the last user message)
  const historyMessages = messages.slice(0, -1)
  const geminiHistory = toGeminiHistory(historyMessages)

  try {
    const geminiResult = await chatWithFunctions(
      context,
      geminiHistory,
      lastUserMessage.content
    )

    let responseMessage: ChatMessage

    if (geminiResult.type === "function_call") {
      const proposal = buildProposal(
        geminiResult.functionName,
        geminiResult.args,
        geminiResult.textBeforeCall
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
        content: geminiResult.text,
        timestamp: Date.now(),
      }
    }

    return NextResponse.json({ message: responseMessage } satisfies ChatResponse)
  } catch (error) {
    console.error("AI chat error:", error)
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "feat(ai): add /api/ai/chat endpoint with function calling and action proposals"
```

---

## Task 4: Execute Action Endpoint (`/api/ai/chat/execute`)

**Files:**
- Create: `src/app/api/ai/chat/execute/route.ts`

**Step 1: Create the execute endpoint**

This endpoint takes an approved ActionProposal and performs the actual DB mutations using the same Prisma logic as the existing schedule APIs.

```typescript
// src/app/api/ai/chat/execute/route.ts

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

function normalizeDate(dateStr: string): string {
  return new Date(dateStr).toISOString().split("T")[0]
}

/** Find the DayPlan for a given date within a trip */
async function findDayPlan(tripId: string, dayDate: string) {
  const dayPlans = await prisma.dayPlan.findMany({
    where: { tripId },
    include: {
      activities: {
        include: { attraction: true, restaurant: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  return dayPlans.find(
    (dp) => normalizeDate(dp.date.toISOString()) === normalizeDate(dayDate)
  )
}

/** Convert ProposedActivity[] to the format expected by Prisma create */
function toActivityCreateData(
  dayPlanId: string,
  activities: ProposedActivity[]
) {
  return activities.map((a, index) => ({
    dayPlanId,
    sortOrder: index,
    type: a.type,
    timeStart: a.timeStart ?? null,
    timeEnd: a.timeEnd ?? null,
    notes: a.notes ?? null,
    attractionId: a.attractionId ?? null,
    restaurantId: a.restaurantId ?? null,
    travelTimeToNextMinutes: null as number | null,
  }))
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as ExecuteActionRequest
  const { tripId, proposal } = body

  if (!tripId || !proposal) {
    return NextResponse.json(
      { error: "tripId and proposal are required" },
      { status: 400 }
    )
  }

  // Verify trip access
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { shares: true },
  })

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  }

  const isOwner = trip.userId === session.user.id
  const isShared = trip.shares.some((s) => s.userId === session.user.id)
  if (!isOwner && !isShared) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    switch (proposal.payload.actionType) {
      case "add_activity": {
        const payload = proposal.payload as AddActivityPayload
        const dayPlan = await findDayPlan(tripId, payload.dayDate)
        if (!dayPlan) {
          return NextResponse.json(
            { error: `Day plan not found for ${payload.dayDate}` },
            { status: 404 }
          )
        }

        // Get current max sortOrder
        const maxSort = dayPlan.activities.reduce(
          (max, a) => Math.max(max, a.sortOrder),
          -1
        )

        await prisma.activity.create({
          data: {
            dayPlanId: dayPlan.id,
            sortOrder: maxSort + 1,
            type: payload.activity.type,
            timeStart: payload.activity.timeStart,
            timeEnd: payload.activity.timeEnd,
            notes: payload.activity.notes,
            attractionId: payload.activity.attractionId,
            restaurantId: payload.activity.restaurantId,
          },
        })
        break
      }

      case "remove_activity": {
        const payload = proposal.payload as RemoveActivityPayload
        const dayPlan = await findDayPlan(tripId, payload.dayDate)
        if (!dayPlan) {
          return NextResponse.json(
            { error: `Day plan not found for ${payload.dayDate}` },
            { status: 404 }
          )
        }

        // Find the activity to remove
        let activityToRemove = payload.activityId
          ? dayPlan.activities.find((a) => a.id === payload.activityId)
          : null

        // If no direct ID match, try matching by name/description
        if (!activityToRemove) {
          const desc = payload.activityDescription.toLowerCase()
          activityToRemove = dayPlan.activities.find((a) => {
            const name = (
              a.attraction?.name ||
              a.restaurant?.name ||
              a.notes ||
              a.type
            ).toLowerCase()
            return name.includes(desc) || desc.includes(name)
          })
        }

        if (!activityToRemove) {
          return NextResponse.json(
            { error: `Activity "${payload.activityDescription}" not found` },
            { status: 404 }
          )
        }

        await prisma.activity.delete({ where: { id: activityToRemove.id } })
        break
      }

      case "replace_day_activities": {
        const payload = proposal.payload as ReplaceDayPayload
        const dayPlan = await findDayPlan(tripId, payload.dayDate)
        if (!dayPlan) {
          return NextResponse.json(
            { error: `Day plan not found for ${payload.dayDate}` },
            { status: 404 }
          )
        }

        const newActivities = toActivityCreateData(dayPlan.id, payload.activities)
        await prisma.$transaction([
          prisma.activity.deleteMany({ where: { dayPlanId: dayPlan.id } }),
          ...newActivities.map((a) => prisma.activity.create({ data: a })),
        ])
        break
      }

      case "plan_full_trip": {
        const payload = proposal.payload as PlanFullTripPayload

        for (const day of payload.days) {
          const dayPlan = await findDayPlan(tripId, day.dayDate)
          if (!dayPlan) continue // Skip days that don't exist

          const newActivities = toActivityCreateData(dayPlan.id, day.activities)
          await prisma.$transaction([
            prisma.activity.deleteMany({ where: { dayPlanId: dayPlan.id } }),
            ...newActivities.map((a) => prisma.activity.create({ data: a })),
          ])
        }
        break
      }

      default:
        return NextResponse.json(
          { error: `Unknown action type` },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true } satisfies ExecuteActionResponse)
  } catch (error) {
    console.error("Execute action error:", error)
    return NextResponse.json(
      { error: "Failed to execute action" },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/ai/chat/execute/route.ts
git commit -m "feat(ai): add /api/ai/chat/execute endpoint for approved action mutations"
```

---

## Task 5: Chat Drawer Component — Message List & Input

**Files:**
- Create: `src/components/ai/ChatDrawer.tsx`
- Create: `src/components/ai/ChatMessage.tsx`

**Step 1: Create the ChatMessage component**

```tsx
// src/components/ai/ChatMessage.tsx
"use client"

import type { ChatMessage as ChatMessageType } from "@/types/ai-chat"
import { ActionProposalCard } from "./ActionProposalCard"

interface ChatMessageProps {
  message: ChatMessageType
  onApprove?: (proposalId: string) => void
  onReject?: (proposalId: string) => void
  isExecuting?: boolean
}

export function ChatMessage({
  message,
  onApprove,
  onReject,
  isExecuting,
}: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      className={`flex ${isUser ? "justify-start" : "justify-end"}`}
      dir="rtl"
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white"
            : "border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        }`}
      >
        {/* Message text */}
        {message.content && (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}

        {/* Action proposal card */}
        {message.actionProposal && (
          <div className="mt-3">
            <ActionProposalCard
              proposal={message.actionProposal}
              onApprove={() => onApprove?.(message.actionProposal!.id)}
              onReject={() => onReject?.(message.actionProposal!.id)}
              isExecuting={isExecuting}
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Create the ChatDrawer component**

```tsx
// src/components/ai/ChatDrawer.tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type {
  ChatMessage as ChatMessageType,
  ActionProposal,
} from "@/types/ai-chat"
import { ChatMessage } from "./ChatMessage"

interface ChatDrawerProps {
  tripId: string
  isOpen: boolean
  onClose: () => void
  onScheduleUpdate: () => void
}

const QUICK_PROMPTS = [
  "תכנן לי את כל הטיול",
  "מה מתאים לאחר הצהריים?",
  "הוסף אטרקציה לילדים למחר",
  "מה לעשות ביום גשום?",
]

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function ChatDrawer({
  tripId,
  isOpen,
  onClose,
  onScheduleUpdate,
}: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(
    null
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMessage: ChatMessageType = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setIsLoading(true)

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId,
            messages: [...messages, userMessage],
          }),
        })

        if (!res.ok) throw new Error("Failed to get response")

        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
      } catch {
        const errorMessage: ChatMessageType = {
          id: generateId(),
          role: "assistant",
          content: "שגיאה בקבלת תשובה. נסו שוב.",
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [tripId, messages, isLoading]
  )

  const handleApprove = useCallback(
    async (proposalId: string) => {
      const msg = messages.find((m) => m.actionProposal?.id === proposalId)
      if (!msg?.actionProposal) return

      setExecutingProposalId(proposalId)

      try {
        const res = await fetch("/api/ai/chat/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId,
            proposal: msg.actionProposal,
          }),
        })

        if (!res.ok) throw new Error("Failed to execute")

        // Update proposal status in message
        setMessages((prev) =>
          prev.map((m) =>
            m.actionProposal?.id === proposalId
              ? {
                  ...m,
                  actionProposal: { ...m.actionProposal!, status: "approved" as const },
                }
              : m
          )
        )

        // Add confirmation message
        const confirmMessage: ChatMessageType = {
          id: generateId(),
          role: "assistant",
          content: "✅ השינוי בוצע בהצלחה! הלו\"ז עודכן.",
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, confirmMessage])

        // Refresh the schedule
        onScheduleUpdate()
      } catch {
        const errorMessage: ChatMessageType = {
          id: generateId(),
          role: "assistant",
          content: "שגיאה בביצוע השינוי. נסו שוב.",
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setExecutingProposalId(null)
      }
    },
    [tripId, messages, onScheduleUpdate]
  )

  const handleReject = useCallback(
    (proposalId: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.actionProposal?.id === proposalId
            ? {
                ...m,
                actionProposal: { ...m.actionProposal!, status: "rejected" as const },
              }
            : m
        )
      )

      const rejectMessage: ChatMessageType = {
        id: generateId(),
        role: "assistant",
        content: "בסדר, ביטלתי את השינוי. אפשר לנסות משהו אחר?",
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, rejectMessage])
    },
    []
  )

  function handleClearChat() {
    setMessages([])
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:border-zinc-700 dark:bg-zinc-900 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              עוזר AI לתכנון הטיול
            </span>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="rounded-lg p-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="נקה שיחה"
              >
                🗑️
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="סגור"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 pt-12 text-center">
              <span className="text-4xl">🤖</span>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                אני יכול לעזור לתכנן את הטיול, להוסיף או להסיר פעילויות,
                ואפילו לתכנן את כל הלו&quot;ז בשבילכם.
              </p>
              {/* Quick prompts */}
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    disabled={isLoading}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isExecuting={executingProposalId === msg.actionProposal?.id}
                />
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-end">
                  <div className="flex gap-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              placeholder="שאלו על הטיול או בקשו שינוי..."
              disabled={isLoading}
              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800"
              dir="rtl"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/ai/ChatDrawer.tsx src/components/ai/ChatMessage.tsx
git commit -m "feat(ai): add ChatDrawer slide-out panel and ChatMessage component"
```

---

## Task 6: Action Proposal Card Component

**Files:**
- Create: `src/components/ai/ActionProposalCard.tsx`

**Step 1: Create the ActionProposalCard component**

This is the structured visual card showing proposed changes with approve/reject buttons.

```tsx
// src/components/ai/ActionProposalCard.tsx
"use client"

import type { ActionProposal, AddActivityPayload, RemoveActivityPayload, ReplaceDayPayload, PlanFullTripPayload, ProposedActivity } from "@/types/ai-chat"

interface ActionProposalCardProps {
  proposal: ActionProposal
  onApprove: () => void
  onReject: () => void
  isExecuting?: boolean
}

const activityTypeLabels: Record<string, string> = {
  attraction: "אטרקציה",
  meal: "ארוחה",
  rest: "מנוחה",
  travel: "נסיעה",
  custom: "אחר",
  lodging: "לינה",
}

const activityTypeIcons: Record<string, string> = {
  attraction: "🎢",
  meal: "🍽️",
  rest: "☕",
  travel: "🚗",
  custom: "📝",
  lodging: "🏨",
}

const actionTypeLabels: Record<string, string> = {
  add_activity: "הוספת פעילות",
  remove_activity: "הסרת פעילות",
  replace_day_activities: "עדכון יום",
  plan_full_trip: "תכנון טיול מלא",
}

const actionTypeIcons: Record<string, string> = {
  add_activity: "➕",
  remove_activity: "➖",
  replace_day_activities: "🔄",
  plan_full_trip: "📋",
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  })
}

function ActivityRow({ activity }: { activity: ProposedActivity }) {
  const icon = activityTypeIcons[activity.type] || "📝"
  const name =
    activity.attractionName ||
    activity.restaurantName ||
    activity.notes ||
    activityTypeLabels[activity.type] ||
    activity.type

  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 text-xs dark:bg-zinc-800">
      <span>{icon}</span>
      <span className="flex-1 font-medium">{name}</span>
      {activity.timeStart && (
        <span className="text-zinc-500 dark:text-zinc-400">
          {activity.timeStart}
          {activity.timeEnd ? ` – ${activity.timeEnd}` : ""}
        </span>
      )}
    </div>
  )
}

function AddActivityPreview({ payload }: { payload: AddActivityPayload }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {formatDate(payload.dayDate)}
      </div>
      <ActivityRow activity={payload.activity} />
    </div>
  )
}

function RemoveActivityPreview({ payload }: { payload: RemoveActivityPayload }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {formatDate(payload.dayDate)}
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 line-through dark:bg-red-950 dark:text-red-400">
        <span>❌</span>
        <span>{payload.activityDescription}</span>
      </div>
    </div>
  )
}

function ReplaceDayPreview({ payload }: { payload: ReplaceDayPayload }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {formatDate(payload.dayDate)} — {payload.activities.length} פעילויות
      </div>
      <div className="flex flex-col gap-1">
        {payload.activities.map((activity, i) => (
          <ActivityRow key={i} activity={activity} />
        ))}
      </div>
    </div>
  )
}

function PlanFullTripPreview({ payload }: { payload: PlanFullTripPayload }) {
  const totalActivities = payload.days.reduce(
    (sum, d) => sum + d.activities.length,
    0
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {payload.days.length} ימים · {totalActivities} פעילויות
      </div>
      <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
        {payload.days.map((day, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              {formatDate(day.dayDate)}
            </div>
            {day.activities.map((activity, j) => (
              <ActivityRow key={j} activity={activity} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ActionProposalCard({
  proposal,
  onApprove,
  onReject,
  isExecuting,
}: ActionProposalCardProps) {
  const isResolved = proposal.status !== "pending"

  return (
    <div
      className={`rounded-xl border p-3 ${
        proposal.status === "approved"
          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950"
          : proposal.status === "rejected"
            ? "border-red-200 bg-red-50 opacity-60 dark:border-red-800 dark:bg-red-950"
            : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
      }`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm">
          {actionTypeIcons[proposal.actionType]}
        </span>
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {actionTypeLabels[proposal.actionType]}
        </span>
        {proposal.status === "approved" && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900 dark:text-green-300">
            ✅ אושר
          </span>
        )}
        {proposal.status === "rejected" && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900 dark:text-red-300">
            ❌ בוטל
          </span>
        )}
      </div>

      {/* Preview based on action type */}
      {proposal.payload.actionType === "add_activity" && (
        <AddActivityPreview payload={proposal.payload as AddActivityPayload} />
      )}
      {proposal.payload.actionType === "remove_activity" && (
        <RemoveActivityPreview payload={proposal.payload as RemoveActivityPayload} />
      )}
      {proposal.payload.actionType === "replace_day_activities" && (
        <ReplaceDayPreview payload={proposal.payload as ReplaceDayPayload} />
      )}
      {proposal.payload.actionType === "plan_full_trip" && (
        <PlanFullTripPreview payload={proposal.payload as PlanFullTripPayload} />
      )}

      {/* Approve / Reject buttons */}
      {!isResolved && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onApprove}
            disabled={isExecuting}
            className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isExecuting ? (
              <span className="flex items-center justify-center gap-1">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                מבצע...
              </span>
            ) : (
              "✅ אשר"
            )}
          </button>
          <button
            onClick={onReject}
            disabled={isExecuting}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            ❌ בטל
          </button>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/ai/ActionProposalCard.tsx
git commit -m "feat(ai): add ActionProposalCard with visual previews for each action type"
```

---

## Task 7: Wire Chat Drawer into ScheduleView

**Files:**
- Modify: `src/components/schedule/ScheduleView.tsx`
- Modify: `src/components/ai/AiAssistant.tsx` (repurpose as trigger button)

**Step 1: Update ScheduleView to include ChatDrawer**

In `src/components/schedule/ScheduleView.tsx`:

1. Replace the `AiAssistant` import:
```typescript
// REMOVE: import { AiAssistant } from "../ai/AiAssistant"
// ADD:
import { ChatDrawer } from "../ai/ChatDrawer"
```

2. Add state for drawer open/close inside the `ScheduleView` component:
```typescript
const [isChatOpen, setIsChatOpen] = useState(false)
```

3. Replace the `<AiAssistant tripId={trip.id} />` usage (around line 295) with:
```tsx
{/* AI Assistant trigger button */}
<button
  onClick={() => setIsChatOpen(true)}
  className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
>
  <span className="text-lg" aria-hidden="true">💡</span>
  עוזר AI לתכנון
</button>
```

4. Add the ChatDrawer at the end, just before the closing `</div>` of the root element:
```tsx
{/* Chat Drawer */}
<ChatDrawer
  tripId={trip.id}
  isOpen={isChatOpen}
  onClose={() => setIsChatOpen(false)}
  onScheduleUpdate={fetchSchedule}
/>
```

**Step 2: Commit**

```bash
git add src/components/schedule/ScheduleView.tsx
git commit -m "feat(ai): wire ChatDrawer into ScheduleView, replace inline AiAssistant"
```

---

## Task 8: Cleanup & Verify Build

**Step 1: Verify the old AiAssistant is no longer imported anywhere**

```bash
grep -r "AiAssistant" src/ --include="*.tsx" --include="*.ts"
```

If it's still imported elsewhere, update those imports. The file itself (`src/components/ai/AiAssistant.tsx`) can remain for now as a reference but is no longer used.

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 3: Run build**

```bash
npm run build
```

Fix any build errors.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix build errors and remove unused AiAssistant import"
```

---

## Summary of Files

| File | Action | Purpose |
|------|--------|---------|
| `src/types/ai-chat.ts` | Create | Shared types for chat, messages, action proposals |
| `src/lib/gemini.ts` | Modify | Add `chatWithFunctions()` + function declarations |
| `src/app/api/ai/chat/route.ts` | Create | Chat endpoint with Gemini function calling |
| `src/app/api/ai/chat/execute/route.ts` | Create | Execute approved actions on the DB |
| `src/components/ai/ChatDrawer.tsx` | Create | Slide-out drawer with message history |
| `src/components/ai/ChatMessage.tsx` | Create | Individual chat message bubble |
| `src/components/ai/ActionProposalCard.tsx` | Create | Visual card for proposed schedule changes |
| `src/components/schedule/ScheduleView.tsx` | Modify | Wire in ChatDrawer, replace AiAssistant |
