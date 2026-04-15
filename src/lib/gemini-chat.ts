import {
  type FunctionDeclaration,
  type Schema,
  GoogleGenerativeAI,
  SchemaType,
} from "@google/generative-ai"

function getClient() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new Error("GEMINI_API_KEY is not configured")
  return new GoogleGenerativeAI(key)
}

// ── AI Chat with Function Calling ───────────────────────────────────

const CHAT_SYSTEM_PROMPT = `אתה עוזר בתכנון טיולים משפחתיים. אתה מדבר בעברית.

כללים חשובים:
- אל תמציא נתונים עובדתיים כמו שעות פתיחה, מחירים או זמני נסיעה.
- כשאתה ממליץ, התבסס על האטרקציות והמסעדות שכבר נשמרו בטיול.
- התחשב בגילאי הילדים ובהעדפות המשפחה.
- השתמש בפונקציות הזמינות כדי לבצע שינויים בלו״ז.
- לפני שאתה קורא לפונקציה, תאר בעברית מה אתה עומד לעשות.
- סוגי פעילויות אפשריים: "attraction" (אטרקציה), "meal" (ארוחה), "rest" (מנוחה), "travel" (נסיעה), "grocery" (קניות מכולת), "custom" (מותאם אישית), "lodging" (לינה).
- כשאתה מוסיף פעילות שמתבססת על אטרקציה או מסעדה שמורה, חובה לכלול את ה-ID שלה.`

const activityTypeEnum = [
  "attraction",
  "meal",
  "rest",
  "travel",
  "custom",
  "lodging",
] as const

const activitySchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    type: {
      type: SchemaType.STRING,
      description: "סוג הפעילות",
      format: "enum",
      enum: [...activityTypeEnum],
    },
    timeStart: {
      type: SchemaType.STRING,
      description: "שעת התחלה בפורמט HH:mm",
    },
    timeEnd: {
      type: SchemaType.STRING,
      description: "שעת סיום בפורמט HH:mm",
    },
    notes: {
      type: SchemaType.STRING,
      description: "הערות או תיאור הפעילות",
    },
    attractionId: {
      type: SchemaType.STRING,
      description: "מזהה האטרקציה מהרשימה השמורה",
    },
    attractionName: {
      type: SchemaType.STRING,
      description: "שם האטרקציה",
    },
    restaurantId: {
      type: SchemaType.STRING,
      description: "מזהה המסעדה מהרשימה השמורה",
    },
    restaurantName: {
      type: SchemaType.STRING,
      description: "שם המסעדה",
    },
  },
  required: ["type"],
}

const chatFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "add_activity",
    description: "הוספת פעילות יחידה ליום מסוים בלו״ז",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        dayDate: {
          type: SchemaType.STRING,
          description: "תאריך היום בפורמט YYYY-MM-DD",
        },
        type: {
          type: SchemaType.STRING,
          description: "סוג הפעילות",
          format: "enum",
          enum: [...activityTypeEnum],
        },
        timeStart: {
          type: SchemaType.STRING,
          description: "שעת התחלה בפורמט HH:mm",
        },
        timeEnd: {
          type: SchemaType.STRING,
          description: "שעת סיום בפורמט HH:mm",
        },
        notes: {
          type: SchemaType.STRING,
          description: "הערות או תיאור הפעילות",
        },
        attractionId: {
          type: SchemaType.STRING,
          description: "מזהה האטרקציה מהרשימה השמורה",
        },
        attractionName: {
          type: SchemaType.STRING,
          description: "שם האטרקציה",
        },
        restaurantId: {
          type: SchemaType.STRING,
          description: "מזהה המסעדה מהרשימה השמורה",
        },
        restaurantName: {
          type: SchemaType.STRING,
          description: "שם המסעדה",
        },
      },
      required: ["dayDate", "type"],
    },
  },
  {
    name: "remove_activity",
    description: "הסרת פעילות מיום מסוים בלו״ז",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        dayDate: {
          type: SchemaType.STRING,
          description: "תאריך היום בפורמט YYYY-MM-DD",
        },
        activityDescription: {
          type: SchemaType.STRING,
          description: "תיאור הפעילות שיש להסיר",
        },
        activityId: {
          type: SchemaType.STRING,
          description: "מזהה הפעילות אם ידוע",
        },
      },
      required: ["dayDate", "activityDescription"],
    },
  },
  {
    name: "replace_day_activities",
    description: "החלפת כל הפעילויות ביום מסוים בלו״ז",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        dayDate: {
          type: SchemaType.STRING,
          description: "תאריך היום בפורמט YYYY-MM-DD",
        },
        activities: {
          type: SchemaType.ARRAY,
          description: "רשימת הפעילויות החדשות ליום",
          items: activitySchema,
        },
      },
      required: ["dayDate", "activities"],
    },
  },
  {
    name: "plan_full_trip",
    description: "תכנון לו״ז מלא לכל ימי הטיול",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        days: {
          type: SchemaType.ARRAY,
          description: "רשימת הימים עם הפעילויות",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              dayDate: {
                type: SchemaType.STRING,
                description: "תאריך היום בפורמט YYYY-MM-DD",
              },
              activities: {
                type: SchemaType.ARRAY,
                description: "רשימת הפעילויות ליום",
                items: activitySchema,
              },
            },
            required: ["dayDate", "activities"],
          },
        },
      },
      required: ["days"],
    },
  },
]

// ── Exported interfaces ─────────────────────────────────────────────

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

// ── Chat with function calling ──────────────────────────────────────

export async function chatWithFunctions(
  context: {
    destination: string
    tripDates: { start: string; end: string }
    familyMembers?: { name: string; age: number; role: string }[]
    savedAttractions?: {
      id: string
      name: string
      status: string
      travelTimeMinutes?: number
    }[]
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
    additionalContext?: string
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

  const chat = model.startChat({ history })

  // On first message, prepend trip context so Gemini knows about the trip
  const message =
    history.length === 0
      ? `${buildChatContext(context)}\n\n${userMessage}`
      : userMessage

  const result = await chat.sendMessage(message)
  const response = result.response
  const candidate = response.candidates?.[0]

  if (candidate?.content?.parts) {
    // Look for a function call part
    let textBeforeCall: string | null = null
    for (const part of candidate.content.parts) {
      if ("text" in part && part.text) {
        textBeforeCall = part.text
      }
      if ("functionCall" in part && part.functionCall) {
        return {
          type: "function_call",
          functionName: part.functionCall.name,
          args: (part.functionCall.args as Record<string, unknown>) ?? {},
          textBeforeCall,
        }
      }
    }
  }

  // No function call — return text
  return {
    type: "text",
    text: response.text(),
  }
}

// ── Helper: build context string ────────────────────────────────────

export function buildChatContext(context: {
  destination: string
  tripDates: { start: string; end: string }
  familyMembers?: { name: string; age: number; role: string }[]
  savedAttractions?: {
    id: string
    name: string
    status: string
    travelTimeMinutes?: number
  }[]
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
  additionalContext?: string
}): string {
  const lines: string[] = []

  lines.push("── מידע על הטיול ──")
  lines.push(`יעד: ${context.destination}`)
  lines.push(`תאריכים: ${context.tripDates.start} עד ${context.tripDates.end}`)

  if (context.familyMembers?.length) {
    lines.push("\nבני משפחה:")
    for (const m of context.familyMembers) {
      lines.push(`• ${m.name} (${m.role}, גיל ${m.age})`)
    }
  }

  if (context.savedAttractions?.length) {
    lines.push("\nאטרקציות שמורות:")
    for (const a of context.savedAttractions) {
      const travel = a.travelTimeMinutes
        ? `, ${a.travelTimeMinutes} דק׳ נסיעה`
        : ""
      lines.push(`• ${a.name} [id: ${a.id}] (${a.status}${travel})`)
    }
  }

  if (context.savedRestaurants?.length) {
    lines.push("\nמסעדות שמורות:")
    for (const r of context.savedRestaurants) {
      const cuisine = r.cuisineType ? `, ${r.cuisineType}` : ""
      lines.push(`• ${r.name} [id: ${r.id}]${cuisine ? ` (${cuisine})` : ""}`)
    }
  }

  if (context.currentSchedule?.length) {
    lines.push("\nלו״ז נוכחי:")
    for (const day of context.currentSchedule) {
      const acts = day.activities
        .map((a) => {
          const time =
            a.timeStart && a.timeEnd ? ` (${a.timeStart}-${a.timeEnd})` : ""
          return `${a.name}${time} [activityId: ${a.id}]`
        })
        .join(", ")
      lines.push(
        `• ${day.date} [dayPlanId: ${day.dayPlanId}]: ${acts || "ריק"}`
      )
    }
  }

  if (context.additionalContext?.trim()) {
    lines.push("\nמידע נוסף:")
    lines.push(context.additionalContext.trim())
  }

  return lines.join("\n")
}
