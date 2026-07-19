// Shared display helpers for rendering schedule days and activities.
// Used by the day timeline, the trip-wide agenda, and the WhatsApp export so
// that icons, labels and date formatting stay consistent across all three.

import type { ActivityData, PlaceData } from "@/components/schedule/ActivityCard"

export const typeConfig: Record<string, { icon: string; label: string }> = {
  attraction: { icon: "\u{1F3DB}️", label: "אטרקציה" },
  meal: { icon: "\u{1F37D}️", label: "ארוחה" },
  travel: { icon: "\u{1F697}", label: "נסיעה" },
  rest: { icon: "\u{1F634}", label: "מנוחה" },
  custom: { icon: "\u{1F4DD}", label: "אחר" },
  grocery: { icon: "🛒", label: "קניות" },
  flight_departure: { icon: "✈️", label: "המראה" },
  flight_arrival: { icon: "🛬", label: "נחיתה" },
  car_pickup: { icon: "📋", label: "איסוף רכב" },
  car_return: { icon: "📋", label: "החזרת רכב" },
  lodging: { icon: "🏨", label: "לינה" },
}

/** Fallback for activity types missing from `typeConfig`. */
const fallbackTypeConfig = { icon: "📌", label: "" }

export const dayTypeConfig: Record<
  string,
  { label: string; icon: string; accent: string }
> = {
  arrival: {
    label: "יום הגעה",
    icon: "✈️",
    accent: "border-green-400 dark:border-green-600",
  },
  departure: {
    label: "יום חזרה",
    icon: "\u{1F6EB}",
    accent: "border-orange-400 dark:border-orange-600",
  },
  full_day: {
    label: "יום מלא",
    icon: "☀️",
    accent: "border-blue-400 dark:border-blue-600",
  },
}

/** Infer meal label from start time */
export function getMealLabel(timeStart: string | null): string {
  if (!timeStart) return "ארוחה"
  const hour = parseInt(timeStart.split(":")[0], 10)
  if (isNaN(hour)) return "ארוחה"
  if (hour < 11) return "ארוחת בוקר"
  if (hour < 16) return "ארוחת צהריים"
  return "ארוחת ערב"
}

export function formatDayDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  })
}

/** The place an activity points at, whichever of the three kinds it is. */
export function activityPlace(activity: {
  attraction: PlaceData | null
  restaurant: PlaceData | null
  groceryStore: PlaceData | null
}): PlaceData | null {
  return activity.attraction ?? activity.restaurant ?? activity.groceryStore
}

/**
 * Icon + human label for an activity, resolving the meal special case where the
 * label depends on the time of day.
 */
export function activityDisplay(
  activity: Pick<ActivityData, "type" | "timeStart">
): { icon: string; label: string } {
  const config = typeConfig[activity.type] ?? {
    ...fallbackTypeConfig,
    label: activity.type,
  }
  if (activity.type === "meal") {
    return { icon: "🍽️", label: getMealLabel(activity.timeStart) }
  }
  return config
}
