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

export interface ExtractedTripDetails {
  flights: {
    outbound?: {
      flightNumber?: string | null
      departureAirport?: string | null
      departureTime?: string | null
      arrivalAirport?: string | null
      arrivalTime?: string | null
    } | null
    return?: {
      flightNumber?: string | null
      departureAirport?: string | null
      departureTime?: string | null
      arrivalAirport?: string | null
      arrivalTime?: string | null
    } | null
  } | null
  accommodation: Array<{
    name?: string | null
    address?: string | null
    checkIn?: string | null
    checkOut?: string | null
    contact?: string | null
    bookingReference?: string | null
  }> | null
  carRental: {
    company?: string | null
    pickupLocation?: string | null
    returnLocation?: string | null
    additionalDetails?: string | null
  } | null
}

const EXTRACTION_PROMPT = `אתה מערכת לחילוץ מידע ממסמכי נסיעות.
נתח את הקובץ המצורף וחלץ ממנו את פרטי הנסיעה הבאים, אם הם קיימים במסמך.
החזר את התוצאה כ-JSON בלבד, בלי טקסט נוסף, בפורמט הבא:
{
  "flights": {
    "outbound": { "flightNumber": "...", "departureAirport": "...", "departureTime": "YYYY-MM-DDTHH:mm", "arrivalAirport": "...", "arrivalTime": "YYYY-MM-DDTHH:mm" },
    "return": { "flightNumber": "...", "departureAirport": "...", "departureTime": "YYYY-MM-DDTHH:mm", "arrivalAirport": "...", "arrivalTime": "YYYY-MM-DDTHH:mm" }
  },
  "accommodation": [{ "name": "...", "address": "...", "checkIn": "YYYY-MM-DDTHH:mm", "checkOut": "YYYY-MM-DDTHH:mm", "contact": "...", "bookingReference": "..." }],
  "carRental": { "company": "...", "pickupLocation": "...", "returnLocation": "...", "additionalDetails": "..." }
}

כללים:
- החזר רק JSON תקין, בלי markdown, בלי backticks, בלי הסברים.
- אם שדה לא נמצא במסמך, השתמש ב-null.
- אם קטגוריה שלמה (טיסות/לינה/רכב) לא נמצאת, השתמש ב-null עבור האובייקט כולו.
- accommodation הוא מערך. אם יש כמה בתי מלון או מקומות לינה, החזר כל אחד כאובייקט נפרד במערך.
- תאריכים בפורמט ISO: YYYY-MM-DDTHH:mm
- שמות שדות תעופה בקוד IATA אם אפשר (לדוגמה: TLV, JFK).`

export async function extractTripDetails(
  fileBase64: string,
  mimeType: string
): Promise<ExtractedTripDetails> {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" })

  const result = await model.generateContent([
    EXTRACTION_PROMPT,
    {
      inlineData: {
        data: fileBase64,
        mimeType,
      },
    },
  ])

  const text = result.response.text().trim()
  // Strip markdown code block fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")

  try {
    return JSON.parse(cleaned) as ExtractedTripDetails
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${cleaned.slice(0, 200)}`)
  }
}

const SYSTEM_PROMPT = `אתה עוזר בתכנון טיולים משפחתיים. אתה מדבר בעברית.
כללים חשובים:
- אל תמציא נתונים עובדתיים כמו שעות פתיחה, מחירים או זמני נסיעה - אלה מגיעים מ-APIs מאומתים.
- אתה יכול להמליץ על אטרקציות, לעזור לארגן את הלו"ז, ולתת טיפים כלליים.
- כשאתה ממליץ, התבסס על האטרקציות שכבר נשמרו בטיול.
- התחשב בגילאי הילדים ובהעדפות המשפחה.`

export async function suggestActivities(context: {
  destination: string
  tripDates: { start: string; end: string }
  familyMembers?: { name: string; age: number; role: string }[]
  savedAttractions?: {
    name: string
    status: string
    travelTimeMinutes?: number
  }[]
  savedRestaurants?: { name: string; cuisineType?: string }[]
  currentSchedule?: { date: string; activities: string[] }[]
  userQuestion: string
}): Promise<string> {
  const contextMessage = `
מידע על הטיול:
- יעד: ${context.destination}
- תאריכים: ${context.tripDates.start} עד ${context.tripDates.end}
${context.familyMembers ? `- בני משפחה: ${context.familyMembers.map((m) => `${m.name} (${m.role}, גיל ${m.age})`).join(", ")}` : ""}
${context.savedAttractions?.length ? `- אטרקציות שנבחרו: ${context.savedAttractions.filter((a) => a.status === "want").map((a) => `${a.name} (${a.travelTimeMinutes || "?"} דק')`).join(", ")}` : ""}
${context.savedRestaurants?.length ? `- מסעדות שנבחרו: ${context.savedRestaurants.map((r) => `${r.name}${r.cuisineType ? ` (${r.cuisineType})` : ""}`).join(", ")}` : ""}
${context.currentSchedule?.length ? `- לו"ז נוכחי: ${context.currentSchedule.map((d) => `${d.date}: ${d.activities.join(", ") || "ריק"}`).join(" | ")}` : ""}

שאלת המשתמש: ${context.userQuestion}`

  const genAI = getClient()
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-pro-preview",
    systemInstruction: SYSTEM_PROMPT,
  })

  const result = await model.generateContent(contextMessage)
  return result.response.text()
}

// ── Destination Info ──────────────────────────────────────────────

export interface DestinationInfo {
  countryCode: string
  countryNameHebrew: string
  destinationNameHebrew: string
  coordinates?: { lat: number; lng: number }
  atAGlance: {
    capital: string
    population: string
    languages: string
    currency: string
    exchangeRate: string
    timezone: string
    electricPlug: string
    emergencyNumber: string
    tippingCustoms: string
  }
  goodToKnow: Array<{ title: string; content: string }>
  kidsCorner: {
    funFacts: string[]
    story: { title: string; content: string }
  }
  dictionary: Array<{
    category: string
    phrases: Array<{
      hebrew: string
      local: string
      transliteration: string
    }>
  }>
  generatedAt: string
}

const DESTINATION_PROMPT = `אתה מומחה לתיירות ותרבות. צור מדריך יעד מקיף בעברית עבור היעד שיינתן לך.

החזר JSON בלבד, ללא markdown, ללא backticks, ללא טקסט נוסף.

מבנה ה-JSON הנדרש:
{
  "countryCode": "קוד מדינה ISO 3166-1 alpha-2 באותיות קטנות (לדוגמה: it, fr, gr)",
  "countryNameHebrew": "שם המדינה בעברית",
  "destinationNameHebrew": "שם היעד בעברית",
  "atAGlance": {
    "capital": "עיר הבירה",
    "population": "אוכלוסייה (מספר מעוגל)",
    "languages": "שפות רשמיות",
    "currency": "מטבע מקומי",
    "exchangeRate": "שער חליפין מול שקל, לדוגמה: 1 EUR = 3.95 ILS",
    "timezone": "אזור זמן, לדוגמה: UTC+1",
    "electricPlug": "סוג תקע חשמלי, לדוגמה: Type C/F, 230V",
    "emergencyNumber": "מספר חירום",
    "tippingCustoms": "מנהגי תשר במקום"
  },
  "goodToKnow": [
    { "title": "נושא", "content": "תוכן מפורט" }
  ],
  "kidsCorner": {
    "funFacts": ["עובדה מעניינת 1", "עובדה 2", ...],
    "story": { "title": "כותרת אגדה או סיפור מקומי", "content": "הסיפור בקצרה" }
  },
  "dictionary": [
    {
      "category": "שם קטגוריה",
      "phrases": [
        { "hebrew": "ביטוי בעברית", "local": "ביטוי בשפה המקומית", "transliteration": "תעתיק לאותיות עבריות" }
      ]
    }
  ]
}

הנחיות:
- goodToKnow: כלול 4-5 נושאים חשובים כגון: תחבורה, בטיחות, מנהגים מקומיים, תרבות אוכל, העונה הטובה לביקור
- kidsCorner: כלול 4-5 עובדות מעניינות לילדים וסיפור/אגדה מקומית אחת
- dictionary: כלול 6 קטגוריות: ברכות, מסעדה, כיוונים, חירום, קניות, מספרים. בכל קטגוריה 5-8 ביטויים
- הביטויים במילון צריכים לכלול עברית, השפה המקומית, ותעתיק באותיות עבריות
- שער החליפין צריך להיות עדכני מול השקל הישראלי (ILS)
- כל התוכן בעברית`

export async function generateDestinationInfo(
  destination: string
): Promise<DestinationInfo> {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-pro-preview",
    tools: [{ googleSearch: {} } as never],
  })

  const result = await model.generateContent(
    `${DESTINATION_PROMPT}\n\nהיעד: ${destination}`
  )

  const text = result.response.text().trim()
  const cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")

  try {
    const info = JSON.parse(cleaned) as DestinationInfo
    info.generatedAt = new Date().toISOString()
    return info
  } catch {
    throw new Error(
      `Failed to parse Gemini destination response as JSON: ${cleaned.slice(0, 200)}`
    )
  }
}

// ── AI Chat with Function Calling ───────────────────────────────────

const CHAT_SYSTEM_PROMPT = `אתה עוזר בתכנון טיולים משפחתיים. אתה מדבר בעברית.

כללים חשובים:
- אל תמציא נתונים עובדתיים כמו שעות פתיחה, מחירים או זמני נסיעה.
- כשאתה ממליץ, התבסס על האטרקציות והמסעדות שכבר נשמרו בטיול.
- התחשב בגילאי הילדים ובהעדפות המשפחה.
- השתמש בפונקציות הזמינות כדי לבצע שינויים בלו״ז.
- לפני שאתה קורא לפונקציה, תאר בעברית מה אתה עומד לעשות.
- סוגי פעילויות אפשריים: "attraction" (אטרקציה), "meal" (ארוחה), "rest" (מנוחה), "travel" (נסיעה), "custom" (מותאם אישית), "lodging" (לינה).
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

function buildChatContext(context: {
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

  return lines.join("\n")
}
