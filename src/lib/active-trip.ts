/**
 * Works out which trip the app should open on and which day of it is "today".
 *
 * Two date conventions meet here and neither is negotiable. `startDate` /
 * `endDate` and `DayPlan.date` are date-only values stored at UTC midnight, so
 * they must be read in UTC (see the same note on `isTripActive` in
 * `src/lib/offline-sync.ts` and `normalizeDate` in `ScheduleView.tsx`). "Today",
 * by contrast, is whichever calendar day it is on the device.
 *
 * The device's day is used deliberately rather than the destination's: a
 * traveller's phone auto-sets to local time on arrival, so the device day is the
 * one the user is actually living in. A per-trip timezone is out of scope.
 */

export interface TripDates {
  id: string
  startDate: string | Date
  endDate: string | Date
}

export type EntryTrip<T extends TripDates> =
  | { trip: T; phase: "in-progress" }
  | { trip: T; phase: "upcoming" }
  | null

/** The device's local calendar day as `YYYY-MM-DD`. */
export function localTodayISO(now: Date = new Date()): string {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/**
 * The `YYYY-MM-DD` of a date-only column, read in UTC so a server- or
 * device-local offset can never shift it onto the wrong day.
 */
export function tripDayISO(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** True when `today` (device-local) falls within the trip's dates, inclusive. */
export function isTripInProgress(trip: TripDates, now: Date = new Date()): boolean {
  const start = tripDayISO(trip.startDate)
  const end = tripDayISO(trip.endDate)
  if (!start || !end) return false
  const today = localTodayISO(now)
  return start <= today && today <= end
}

/**
 * Picks the trip to land on: an in-progress one if there is one, otherwise the
 * nearest upcoming one, otherwise nothing. Assumes at most one in-progress trip
 * per user.
 */
export function resolveEntryTrip<T extends TripDates>(
  trips: T[],
  now: Date = new Date()
): EntryTrip<T> {
  const today = localTodayISO(now)

  const inProgress = trips.find((t) => {
    const start = tripDayISO(t.startDate)
    const end = tripDayISO(t.endDate)
    return start && end && start <= today && today <= end
  })
  if (inProgress) return { trip: inProgress, phase: "in-progress" }

  const upcoming = trips
    .filter((t) => {
      const start = tripDayISO(t.startDate)
      return start && start > today
    })
    .sort((a, b) => tripDayISO(a.startDate).localeCompare(tripDayISO(b.startDate)))[0]
  if (upcoming) return { trip: upcoming, phase: "upcoming" }

  return null
}

/**
 * Which day of a schedule to open on.
 *
 * Mid-trip the answer is almost always today — that is what the app is being
 * used for while standing on a street somewhere. A day pinned in the URL still
 * wins, so a shared link to a specific day and a manual selection both survive
 * a refresh, while a bare visit re-picks today.
 */
export function pickInitialDay<T extends { id: string; date: string | Date }>(
  dayPlans: T[],
  pinnedDay: string | null,
  now: Date = new Date()
): string | null {
  if (dayPlans.length === 0) return null

  if (pinnedDay) {
    const pinned = dayPlans.find((d) => tripDayISO(d.date) === pinnedDay)
    if (pinned) return pinned.id
  }

  const today = dayPlans.find((d) => tripDayISO(d.date) === localTodayISO(now))
  if (today) return today.id

  return dayPlans[0].id
}
