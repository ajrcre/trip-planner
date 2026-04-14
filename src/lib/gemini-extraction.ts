import { GoogleGenerativeAI } from "@google/generative-ai"

function getClient() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new Error("GEMINI_API_KEY is not configured")
  return new GoogleGenerativeAI(key)
}

export interface ExtractedTripDetails {
  destination?: string | null
  startDate?: string | null
  endDate?: string | null
  flights: Array<{
    flightNumber?: string | null
    departureAirport?: string | null
    departureTime?: string | null
    arrivalAirport?: string | null
    arrivalTime?: string | null
  }> | null
  accommodation: Array<{
    name?: string | null
    address?: string | null
    checkIn?: string | null
    checkOut?: string | null
    contact?: string | null
    bookingReference?: string | null
  }> | null
  carRental: Array<{
    company?: string | null
    pickupLocation?: string | null
    pickupTime?: string | null
    returnLocation?: string | null
    returnTime?: string | null
    additionalDetails?: string | null
  }> | null
}

const EXTRACTION_PROMPT = `אתה מערכת לחילוץ מידע ממסמכי נסיעות.
נתח את הקובץ המצורף וחלץ ממנו את פרטי הנסיעה הבאים, אם הם קיימים במסמך.
החזר את התוצאה כ-JSON בלבד, בלי טקסט נוסף, בפורמט הבא:
{
  "destination": "שם היעד",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "flights": [
    { "flightNumber": "...", "departureAirport": "...", "departureTime": "YYYY-MM-DDTHH:mm", "arrivalAirport": "...", "arrivalTime": "YYYY-MM-DDTHH:mm" }
  ],
  "accommodation": [
    { "name": "...", "address": "...", "checkIn": "YYYY-MM-DDTHH:mm", "checkOut": "YYYY-MM-DDTHH:mm", "contact": "...", "bookingReference": "..." }
  ],
  "carRental": [
    { "company": "...", "pickupLocation": "...", "pickupTime": "YYYY-MM-DDTHH:mm", "returnLocation": "...", "returnTime": "YYYY-MM-DDTHH:mm", "additionalDetails": "..." }
  ]
}

כללים:
- החזר רק JSON תקין, בלי markdown, בלי backticks, בלי הסברים.
- אם שדה לא נמצא במסמך, השתמש ב-null.
- אם קטגוריה שלמה (טיסות/לינה/רכב) לא נמצאת, השתמש ב-null עבור המערך כולו.
- flights הוא מערך. כל רגל טיסה (כולל קונקשנים, טיסות פנימיות, טיסת חזור) היא אובייקט נפרד במערך.
- accommodation הוא מערך. אם יש כמה בתי מלון או מקומות לינה, החזר כל אחד כאובייקט נפרד במערך.
- carRental הוא מערך. אם יש כמה השכרות רכב, החזר כל אחת כאובייקט נפרד במערך.
- אם ניתן לזהות את יעד הנסיעה, תאריך התחלה או תאריך סיום, מלא אותם. אם לא, השתמש ב-null.
- תאריכים בפורמט ISO: YYYY-MM-DDTHH:mm (או YYYY-MM-DD עבור startDate/endDate)
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

// ── Shopping Item Translation ───────────────────────────────────────

const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  it: "איטלקית", fr: "צרפתית", es: "ספרדית", de: "גרמנית", pt: "פורטוגזית",
  gr: "יוונית", nl: "הולנדית", tr: "טורקית", jp: "יפנית", kr: "קוריאנית",
  cn: "סינית", th: "תאילנדית", cz: "צ׳כית", pl: "פולנית", hr: "קרואטית",
  hu: "הונגרית", ro: "רומנית", bg: "בולגרית", rs: "סרבית", se: "שוודית",
  no: "נורווגית", dk: "דנית", fi: "פינית", ru: "רוסית", ua: "אוקראינית",
  gb: "אנגלית", us: "אנגלית", au: "אנגלית", at: "גרמנית", ch: "גרמנית",
  br: "פורטוגזית", mx: "ספרדית", ar: "ספרדית", eg: "ערבית", ma: "ערבית",
  in: "הינדית", id: "אינדונזית", vn: "וייטנאמית", ph: "טאגלוג",
}

export interface TranslatedItem {
  id: string
  localName: string
  transliteration: string
}

export async function translateShoppingItems(
  items: Array<{ id: string; item: string }>,
  countryCode: string
): Promise<TranslatedItem[]> {
  if (items.length === 0) return []

  const language = COUNTRY_TO_LANGUAGE[countryCode]
  const languageLabel = language || `השפה המקומית של מדינה עם קוד ${countryCode}`

  const itemsList = items.map((i) => `- id: "${i.id}", item: "${i.item}"`).join("\n")

  const prompt = `תרגם את פריטי הקניות הבאים מעברית ל${languageLabel}.

עבור כל פריט, החזר:
- id: אותו id שקיבלת
- localName: שם הפריט ב${languageLabel}
- transliteration: תעתיק לאותיות עבריות (כדי שדובר עברית ידע איך לבטא)

הפריטים:
${itemsList}

החזר JSON בלבד, ללא markdown, ללא backticks, ללא הסברים.
מבנה: מערך של אובייקטים [{ "id": "...", "localName": "...", "transliteration": "..." }]`

  const genAI = getClient()
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" })
  const result = await model.generateContent(prompt)

  const text = result.response.text().trim()
  const cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")

  try {
    return JSON.parse(cleaned) as TranslatedItem[]
  } catch {
    throw new Error(
      `Failed to parse Gemini translation response as JSON: ${cleaned.slice(0, 200)}`
    )
  }
}
