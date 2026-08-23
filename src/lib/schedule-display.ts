// Shared display helpers for rendering schedule days and activities.
// Used by the day timeline, the trip-wide agenda, and the WhatsApp export so
// that icons, labels and date formatting stay consistent across all three.
//
// Each config carries two representations of the same icon: `icon` is an emoji
// for the plain-text exports (WhatsApp clipboard, DOCX), and `Icon` is a
// component for the screen. They must stay in sync — a React component cannot
// go into a clipboard string, and an emoji cannot inherit text colour.

import type { LucideIcon } from "lucide-react"

import type { ActivityData, PlaceData } from "@/components/schedule/ActivityCard"
import {
  activityTypeIcons,
  attractionIcon,
  dayTypeIcons,
  fallbackActivityIcon,
} from "@/lib/icons"

export const typeConfig: Record<
  string,
  { icon: string; label: string; Icon: LucideIcon }
> = {
  attraction: { icon: "\u{1F3DB}️", label: "אטרקציה", Icon: activityTypeIcons.attraction },
  meal: { icon: "\u{1F37D}️", label: "ארוחה", Icon: activityTypeIcons.meal },
  travel: { icon: "\u{1F697}", label: "נסיעה", Icon: activityTypeIcons.travel },
  rest: { icon: "\u{1F634}", label: "מנוחה", Icon: activityTypeIcons.rest },
  custom: { icon: "\u{1F4DD}", label: "אחר", Icon: activityTypeIcons.custom },
  grocery: { icon: "🛒", label: "קניות", Icon: activityTypeIcons.grocery },
  flight_departure: { icon: "✈️", label: "המראה", Icon: activityTypeIcons.flight_departure },
  flight_arrival: { icon: "🛬", label: "נחיתה", Icon: activityTypeIcons.flight_arrival },
  car_pickup: { icon: "📋", label: "איסוף רכב", Icon: activityTypeIcons.car_pickup },
  car_return: { icon: "📋", label: "החזרת רכב", Icon: activityTypeIcons.car_return },
  lodging: { icon: "🏨", label: "לינה", Icon: activityTypeIcons.lodging },
}

/** Fallback for activity types missing from `typeConfig`. */
const fallbackTypeConfig = { icon: "📌", label: "", Icon: fallbackActivityIcon }

export const dayTypeConfig: Record<
  string,
  { label: string; icon: string; Icon: LucideIcon; accent: string }
> = {
  arrival: {
    label: "יום הגעה",
    icon: "✈️",
    Icon: dayTypeIcons.arrival,
    accent: "border-green-400 dark:border-green-600",
  },
  departure: {
    label: "יום חזרה",
    icon: "\u{1F6EB}",
    Icon: dayTypeIcons.departure,
    accent: "border-orange-400 dark:border-orange-600",
  },
  full_day: {
    label: "יום מלא",
    icon: "☀️",
    Icon: dayTypeIcons.full_day,
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
 * label depends on the time of day, and the attraction case where the icon
 * depends on what kind of place it is.
 *
 * Pass `place` to get the type-specific attraction icon; without it attractions
 * fall back to the generic landmark.
 */
export function activityDisplay(
  activity: Pick<ActivityData, "type" | "timeStart">,
  place?: Pick<PlaceData, "attractionType"> | null
): { icon: string; label: string; Icon: LucideIcon } {
  const config = typeConfig[activity.type] ?? {
    ...fallbackTypeConfig,
    label: activity.type,
  }
  if (activity.type === "meal") {
    return { icon: "🍽️", label: getMealLabel(activity.timeStart), Icon: config.Icon }
  }
  if (activity.type === "attraction") {
    return { ...config, Icon: attractionIcon(place?.attractionType) }
  }
  return config
}
