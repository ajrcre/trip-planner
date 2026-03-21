import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic() // Uses ANTHROPIC_API_KEY env var automatically

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

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: contextMessage }],
  })

  return response.content[0].type === "text" ? response.content[0].text : ""
}
