import type { ActivityData } from "@/components/schedule/ActivityCard"
import type { DayPlanData } from "@/components/schedule/DayTimeline"
import type { Accommodation } from "@/lib/accommodations"
import { parseDayHours, DAY_NAMES_EN, DAY_NAMES_HE, formatAmPmTimesInText } from "@/lib/time-parsing"
import { googleMapsUrl } from "@/lib/url-helpers"
import { alternativePlanLabel } from "@/lib/activity-alternatives"

const dayTypeLabels: Record<string, { label: string; icon: string }> = {
  arrival: { label: "יום הגעה", icon: "✈️" },
  departure: { label: "יום חזרה", icon: "🛫" },
  full_day: { label: "יום מלא", icon: "☀️" },
}

const typeConfig: Record<string, { icon: string; label: string }> = {
  attraction: { icon: "🏛️", label: "אטרקציה" },
  meal: { icon: "🍽️", label: "ארוחה" },
  travel: { icon: "🚗", label: "נסיעה" },
  rest: { icon: "😴", label: "מנוחה" },
  custom: { icon: "📝", label: "אחר" },
  grocery: { icon: "🛒", label: "קניות" },
  flight_departure: { icon: "✈️", label: "המראה" },
  flight_arrival: { icon: "🛬", label: "נחיתה" },
  car_pickup: { icon: "📋", label: "איסוף רכב" },
  car_return: { icon: "📋", label: "החזרת רכב" },
  lodging: { icon: "🏨", label: "לינה" },
}

function getMealLabel(timeStart: string | null): string {
  if (!timeStart) return "ארוחה"
  const hour = parseInt(timeStart.split(":")[0], 10)
  if (isNaN(hour)) return "ארוחה"
  if (hour < 11) return "ארוחת בוקר"
  if (hour < 16) return "ארוחת צהריים"
  return "ארוחת ערב"
}

function formatDayDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  })
}

function getOpeningHoursForDate(openingHours: unknown, dateStr: string): string | null {
  const allHours = parseDayHours(openingHours)
  if (allHours.length === 0) return null
  const targetDate = new Date(dateStr)
  const dayIndex = targetDate.getUTCDay()
  const dayNameEn = DAY_NAMES_EN[dayIndex]
  const dayNameHe = DAY_NAMES_HE[dayNameEn]
  const today = allHours.find((h) => h.dayName === dayNameEn || h.dayName === dayNameHe)
  if (!today) return null
  const dayLabel = DAY_NAMES_HE[today.dayName] ?? today.dayName
  return `${dayLabel}: ${today.hours ? formatAmPmTimesInText(today.hours) : "סגור"}`
}

function formatActivity(
  activity: ActivityData,
  tripAccommodations: Accommodation[],
  dateStr: string,
): string {
  const lines: string[] = []
  const place = activity.attraction ?? activity.restaurant ?? activity.groceryStore
  const config = typeConfig[activity.type] ?? { icon: "📌", label: activity.type }
  const label = activity.type === "meal" ? getMealLabel(activity.timeStart) : config.label
  const icon = activity.type === "meal" ? "🍽️" : config.icon

  // Time + type line
  const timePart = activity.timeStart
    ? `*${activity.timeStart}${activity.timeEnd ? ` - ${activity.timeEnd}` : ""}*`
    : null
  const typeLine = timePart ? `${timePart} | ${icon} ${label}` : `${icon} ${label}`
  lines.push(typeLine)

  // Activity name / details
  if (
    activity.type === "travel" &&
    activity.travelLeg?.resolvedOrigin &&
    activity.travelLeg?.resolvedDestination
  ) {
    lines.push(`*${activity.travelLeg.resolvedOrigin.label} → ${activity.travelLeg.resolvedDestination.label}*`)
    // Directions link
    const o = activity.travelLeg.resolvedOrigin
    const d = activity.travelLeg.resolvedDestination
    if (o.lat != null && o.lng != null && d.lat != null && d.lng != null) {
      lines.push(`🗺️ https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}&travelmode=driving`)
    }
    if (activity.travelLeg.driveMinutes != null) {
      lines.push(`🚗 _${activity.travelLeg.driveMinutes} דק׳ נסיעה משוערות_`)
    }
  } else if (
    activity.type === "rest" &&
    activity.restAccommodationIndex != null &&
    tripAccommodations[activity.restAccommodationIndex]?.name
  ) {
    lines.push(`*מנוחה — ${tripAccommodations[activity.restAccommodationIndex]!.name}*`)
  } else if (place) {
    lines.push(`*${place.name}*`)
    lines.push(`📍 ${googleMapsUrl(place.name, place)}`)
    if (place.phone) {
      lines.push(`📞 ${place.phone}`)
    }
    const hours = getOpeningHoursForDate(place.openingHours, dateStr)
    if (hours) {
      lines.push(`🕐 ${hours}`)
    }
  } else if (activity.notes) {
    lines.push(`*${activity.notes}*`)
  }

  // Notes (when not already used as the name)
  if (
    activity.notes &&
    place &&
    activity.type !== "custom" &&
    activity.type !== "travel"
  ) {
    lines.push(`📝 ${activity.notes}`)
  }

  // Backup alternatives (Plan B, C, D...)
  if (activity.alternatives && activity.alternatives.length > 0) {
    lines.push("")
    for (const alt of activity.alternatives) {
      const altPlace = alt.attraction ?? alt.restaurant ?? alt.groceryStore
      if (!altPlace) continue
      const label = alternativePlanLabel(alt.priority)
      lines.push(`↳ *${label}:* ${altPlace.name}`)
      if (altPlace.phone) lines.push(`  📞 ${altPlace.phone}`)
      const altHours = getOpeningHoursForDate(altPlace.openingHours, dateStr)
      if (altHours) lines.push(`  🕐 ${altHours}`)
      if (alt.notes) lines.push(`  📝 ${alt.notes}`)
    }
  }

  return lines.join("\n")
}

export function formatDayForWhatsApp(
  dayPlan: DayPlanData,
  tripAccommodations: Accommodation[],
): string {
  const dtConfig = dayTypeLabels[dayPlan.dayType] ?? dayTypeLabels.full_day
  const header = `*${formatDayDate(dayPlan.date)} — ${dtConfig.label}* ${dtConfig.icon}`

  const blocks: string[] = [header]

  for (let i = 0; i < dayPlan.activities.length; i++) {
    const activity = dayPlan.activities[i]
    blocks.push(formatActivity(activity, tripAccommodations, dayPlan.date))

    // Travel time separator
    if (
      activity.travelTimeToNextMinutes != null &&
      activity.travelTimeToNextMinutes > 0 &&
      i < dayPlan.activities.length - 1
    ) {
      blocks.push(`🚗 _${activity.travelTimeToNextMinutes} דק׳ נסיעה_`)
    }
  }

  return blocks.join("\n\n")
}
