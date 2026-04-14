export const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export const DAY_NAMES_HE: Record<string, string> = {
  Sunday: "ראשון",
  Monday: "שני",
  Tuesday: "שלישי",
  Wednesday: "רביעי",
  Thursday: "חמישי",
  Friday: "שישי",
  Saturday: "שבת",
}

export function parseDayHours(openingHours: unknown): { dayName: string; hours: string }[] {
  // Handle both array format ["Monday: Closed", ...] and wrapped object { weekdayDescriptions: [...] }
  let hours = openingHours
  if (hours && typeof hours === "object" && !Array.isArray(hours) && "weekdayDescriptions" in (hours as Record<string, unknown>)) {
    hours = (hours as Record<string, unknown>).weekdayDescriptions
  }
  if (!Array.isArray(hours)) return []
  return hours
    .filter((h): h is string => typeof h === "string")
    .map((entry) => {
      const colonIdx = entry.indexOf(":")
      if (colonIdx === -1) return { dayName: entry, hours: "" }
      return {
        dayName: entry.slice(0, colonIdx).trim(),
        hours: entry.slice(colonIdx + 1).trim(),
      }
    })
}

export function getTodayHours(openingHours: unknown): { dayName: string; hours: string } | null {
  const parsed = parseDayHours(openingHours)
  const todayName = DAY_NAMES_EN[new Date().getDay()]
  return parsed.find((h) => h.dayName === todayName) ?? null
}

/** Parse "9:00 AM" or "10:30 PM" into 24h "HH:MM" string */
export function parseAmPmTo24(timeStr: string): string | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hour = parseInt(match[1], 10)
  const minute = match[2]
  const ampm = match[3].toUpperCase()
  if (ampm === "PM" && hour !== 12) hour += 12
  if (ampm === "AM" && hour === 12) hour = 0
  return `${hour.toString().padStart(2, "0")}:${minute}`
}

/** Replace English AM/PM times in a string (e.g. Google weekdayDescriptions) with 24h HH:MM */
export function formatAmPmTimesInText(text: string): string {
  return text.replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi, (full) => {
    const t = parseAmPmTo24(full.trim())
    return t ?? full
  })
}

export function parseOpenClose(hoursStr: string): { open: string; close: string } | null {
  // e.g. "9:00 AM – 6:00 PM" or "9:00 AM - 6:00 PM"
  const parts = hoursStr.split(/\s*[–-]\s*/)
  if (parts.length !== 2) return null
  const open = parseAmPmTo24(parts[0])
  const close = parseAmPmTo24(parts[1])
  if (!open || !close) return null
  return { open, close }
}

export function getScheduleDayHours(openingHours: unknown, scheduleDate?: string): { dayName: string; hours: string } | null {
  const parsed = parseDayHours(openingHours)
  const targetDate = scheduleDate ? new Date(scheduleDate) : new Date()
  const dayIndex = scheduleDate ? targetDate.getUTCDay() : targetDate.getDay()
  const dayNameEn = DAY_NAMES_EN[dayIndex]
  const dayNameHe = DAY_NAMES_HE[dayNameEn]
  return parsed.find((h) => h.dayName === dayNameEn || h.dayName === dayNameHe) ?? null
}

export function detectTimeConflict(
  activityTimeStart: string | null,
  activityTimeEnd: string | null,
  openingHours: unknown,
  scheduleDate?: string
): { earlyArrival?: { opensAt: string; arrivesAt: string }; lateStay?: { closesAt: string; leavesAt: string } } | null {
  const dayHours = getScheduleDayHours(openingHours, scheduleDate)
  if (!dayHours) return null
  const times = parseOpenClose(dayHours.hours)
  if (!times) return null

  const result: { earlyArrival?: { opensAt: string; arrivesAt: string }; lateStay?: { closesAt: string; leavesAt: string } } = {}

  if (activityTimeStart && activityTimeStart < times.open) {
    const parts = dayHours.hours.split(/\s*[–-]\s*/)
    const rawOpen = parts[0]?.trim() ?? times.open
    result.earlyArrival = {
      opensAt: formatAmPmTimesInText(rawOpen),
      arrivesAt: activityTimeStart,
    }
  }
  if (activityTimeEnd && activityTimeEnd > times.close) {
    const parts = dayHours.hours.split(/\s*[–-]\s*/)
    const rawClose = parts[1]?.trim() ?? times.close
    result.lateStay = {
      closesAt: formatAmPmTimesInText(rawClose),
      leavesAt: activityTimeEnd,
    }
  }

  return result.earlyArrival || result.lateStay ? result : null
}
