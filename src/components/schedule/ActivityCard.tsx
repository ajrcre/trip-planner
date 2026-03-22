"use client"

import { useState, useMemo } from "react"

export interface ActivityData {
  id: string
  sortOrder: number
  timeStart: string | null
  timeEnd: string | null
  type: string
  notes: string | null
  attractionId: string | null
  restaurantId: string | null
  travelTimeToNextMinutes: number | null
  attraction: {
    id: string
    name: string
    address: string | null
    phone: string | null
    website: string | null
    googlePlaceId: string | null
    openingHours: unknown
    lat: number | null
    lng: number | null
  } | null
  restaurant: {
    id: string
    name: string
    address: string | null
    phone: string | null
    website: string | null
    googlePlaceId: string | null
    openingHours: unknown
    lat: number | null
    lng: number | null
  } | null
  drivingTimesFromLodging?: { accommodationName: string; minutes: number }[]
}

const typeConfig: Record<string, { icon: string; label: string }> = {
  attraction: { icon: "\u{1F3DB}\uFE0F", label: "\u05D0\u05D8\u05E8\u05E7\u05E6\u05D9\u05D4" },
  meal: { icon: "\u{1F37D}\uFE0F", label: "\u05D0\u05E8\u05D5\u05D7\u05D4" },
  travel: { icon: "\u{1F697}", label: "\u05E0\u05E1\u05D9\u05E2\u05D4" },
  rest: { icon: "\u{1F634}", label: "\u05DE\u05E0\u05D5\u05D7\u05D4" },
  custom: { icon: "\u{1F4DD}", label: "\u05D0\u05D7\u05E8" },
  flight_departure: { icon: "✈️", label: "טיסת יציאה" },
  flight_arrival: { icon: "🛬", label: "טיסת הגעה" },
  car_pickup: { icon: "🚗", label: "איסוף רכב" },
  car_return: { icon: "🔑", label: "החזרת רכב" },
}

const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const DAY_NAMES_HE: Record<string, string> = {
  Sunday: "ראשון",
  Monday: "שני",
  Tuesday: "שלישי",
  Wednesday: "רביעי",
  Thursday: "חמישי",
  Friday: "שישי",
  Saturday: "שבת",
}

function parseDayHours(openingHours: unknown): { dayName: string; hours: string }[] {
  if (!Array.isArray(openingHours)) return []
  return openingHours
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

function getTodayHours(openingHours: unknown): { dayName: string; hours: string } | null {
  const parsed = parseDayHours(openingHours)
  const todayName = DAY_NAMES_EN[new Date().getDay()]
  return parsed.find((h) => h.dayName === todayName) ?? null
}

/** Parse "9:00 AM" or "10:30 PM" into 24h "HH:MM" string */
function parseAmPmTo24(timeStr: string): string | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hour = parseInt(match[1], 10)
  const minute = match[2]
  const ampm = match[3].toUpperCase()
  if (ampm === "PM" && hour !== 12) hour += 12
  if (ampm === "AM" && hour === 12) hour = 0
  return `${hour.toString().padStart(2, "0")}:${minute}`
}

function parseOpenClose(hoursStr: string): { open: string; close: string } | null {
  // e.g. "9:00 AM – 6:00 PM" or "9:00 AM - 6:00 PM"
  const parts = hoursStr.split(/\s*[–-]\s*/)
  if (parts.length !== 2) return null
  const open = parseAmPmTo24(parts[0])
  const close = parseAmPmTo24(parts[1])
  if (!open || !close) return null
  return { open, close }
}

function detectTimeConflict(
  activityTimeStart: string | null,
  activityTimeEnd: string | null,
  openingHours: unknown
): { earlyArrival?: { opensAt: string; arrivesAt: string }; lateStay?: { closesAt: string; leavesAt: string } } | null {
  const today = getTodayHours(openingHours)
  if (!today) return null
  const times = parseOpenClose(today.hours)
  if (!times) return null

  const result: { earlyArrival?: { opensAt: string; arrivesAt: string }; lateStay?: { closesAt: string; leavesAt: string } } = {}

  if (activityTimeStart && activityTimeStart < times.open) {
    // Find the original AM/PM string for display
    const parts = today.hours.split(/\s*[–-]\s*/)
    result.earlyArrival = { opensAt: parts[0]?.trim() ?? times.open, arrivesAt: activityTimeStart }
  }
  if (activityTimeEnd && activityTimeEnd > times.close) {
    const parts = today.hours.split(/\s*[–-]\s*/)
    result.lateStay = { closesAt: parts[1]?.trim() ?? times.close, leavesAt: activityTimeEnd }
  }

  return result.earlyArrival || result.lateStay ? result : null
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function OpeningHoursSection({ openingHours }: { openingHours: unknown }) {
  const [showAll, setShowAll] = useState(false)
  const allHours = parseDayHours(openingHours)
  const todayName = DAY_NAMES_EN[new Date().getDay()]
  const today = allHours.find((h) => h.dayName === todayName) ?? null

  if (!today && allHours.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs">🕐</span>
        {today ? (
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            היום ({DAY_NAMES_HE[today.dayName] ?? today.dayName}): {today.hours || "סגור"}
          </span>
        ) : (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">שעות פתיחה לא זמינות להיום</span>
        )}
      </div>
      {allHours.length > 0 && (
        <>
          <button
            onClick={() => setShowAll(!showAll)}
            className="mr-5 text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-right"
          >
            {showAll ? "הסתר שעות פתיחה" : "כל שעות הפתיחה"}
          </button>
          {showAll && (
            <div className="mr-5 flex flex-col gap-0.5">
              {allHours.map((h, i) => (
                <span
                  key={i}
                  className={`text-[11px] ${
                    h.dayName === todayName
                      ? "font-semibold text-zinc-700 dark:text-zinc-200"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {DAY_NAMES_HE[h.dayName] ?? h.dayName}: {h.hours || "סגור"}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface ActivityCardProps {
  activity: ActivityData
  onEdit: (activity: ActivityData, updates: { timeStart?: string; timeEnd?: string; notes?: string }) => void
  onDelete: (activityId: string) => void
}

export function ActivityCard({ activity, onEdit, onDelete }: ActivityCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [editTimeStart, setEditTimeStart] = useState(activity.timeStart ?? "")
  const [editTimeEnd, setEditTimeEnd] = useState(activity.timeEnd ?? "")
  const [editNotes, setEditNotes] = useState(activity.notes ?? "")

  const config = typeConfig[activity.type] ?? typeConfig.custom

  const place = activity.attraction ?? activity.restaurant
  const hasDetails = !!(place && (place.address || place.phone || place.website || place.openingHours))

  const timeConflict = useMemo(() => {
    if (!place?.openingHours) return null
    return detectTimeConflict(activity.timeStart, activity.timeEnd, place.openingHours)
  }, [activity.timeStart, activity.timeEnd, place?.openingHours])

  const name =
    activity.attraction?.name ??
    activity.restaurant?.name ??
    activity.notes ??
    config.label

  function handleSave() {
    onEdit(activity, {
      timeStart: editTimeStart || undefined,
      timeEnd: editTimeEnd || undefined,
      notes: editNotes || undefined,
    })
    setIsEditing(false)
  }

  function handleCancel() {
    setEditTimeStart(activity.timeStart ?? "")
    setEditTimeEnd(activity.timeEnd ?? "")
    setEditNotes(activity.notes ?? "")
    setIsEditing(false)
  }

  return (
    <div className="group relative rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800">
      {/* Drag handle placeholder */}
      <div className="absolute right-2 top-2 cursor-grab text-zinc-300 dark:text-zinc-600">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="3" cy="2" r="1.5" />
          <circle cx="9" cy="2" r="1.5" />
          <circle cx="3" cy="6" r="1.5" />
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="3" cy="10" r="1.5" />
          <circle cx="9" cy="10" r="1.5" />
        </svg>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{config.icon}</span>
            <span className="text-sm font-medium">{name}</span>
          </div>

          <div className="flex gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">{"\u05E9\u05E2\u05EA \u05D4\u05EA\u05D7\u05DC\u05D4"}</label>
              <input
                type="time"
                value={editTimeStart}
                onChange={(e) => setEditTimeStart(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">{"\u05E9\u05E2\u05EA \u05E1\u05D9\u05D5\u05DD"}</label>
              <input
                type="time"
                value={editTimeEnd}
                onChange={(e) => setEditTimeEnd(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">{"\u05D4\u05E2\u05E8\u05D5\u05EA"}</label>
            <input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder={"\u05D4\u05E2\u05E8\u05D5\u05EA..."}
              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
            >
              {"\u05E9\u05DE\u05D5\u05E8"}
            </button>
            <button
              onClick={handleCancel}
              className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700"
            >
              {"\u05D1\u05D9\u05D8\u05D5\u05DC"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 pr-6">
          <span className="mt-0.5 text-lg">{config.icon}</span>

          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{name}</span>
            </div>

            {(activity.timeStart || activity.timeEnd) && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {activity.timeStart ?? ""}
                {activity.timeStart && activity.timeEnd ? " - " : ""}
                {activity.timeEnd ?? ""}
              </span>
            )}

            {/* Driving time from lodging — only for place-based activities */}
            {activity.drivingTimesFromLodging &&
              activity.drivingTimesFromLodging.length > 0 &&
              !["travel", "rest", "flight_departure", "flight_arrival", "car_pickup", "car_return"].includes(activity.type) && (
                <div className="flex flex-wrap gap-1.5">
                  {activity.drivingTimesFromLodging.map((dt, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      title={`נסיעה מ${dt.accommodationName}`}
                    >
                      🏨→🚗 {dt.minutes} דק׳
                      {activity.drivingTimesFromLodging!.length > 1 && (
                        <span className="text-blue-400 dark:text-blue-500">
                          ({dt.accommodationName})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}

            {activity.notes && activity.type !== "custom" && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {activity.notes}
              </span>
            )}

            {/* Collapsible place details */}
            {hasDetails && (
              <div className="mt-1">
                <button
                  onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transition-transform ${isDetailsOpen ? "rotate-90" : "rotate-0"}`}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  {isDetailsOpen ? "הסתר פרטים" : "הצג פרטים"}
                </button>

                {isDetailsOpen && place && (
                  <div className="mt-1.5 flex flex-col gap-1.5 rounded-md bg-zinc-50 p-2.5 dark:bg-zinc-700/50">
                    {/* Time conflict warnings */}
                    {timeConflict?.earlyArrival && (
                      <div className="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <span>⚠️</span>
                        <span>
                          נפתח ב-{timeConflict.earlyArrival.opensAt} — אתם מגיעים ב-{timeConflict.earlyArrival.arrivesAt}
                        </span>
                      </div>
                    )}
                    {timeConflict?.lateStay && (
                      <div className="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <span>⚠️</span>
                        <span>
                          נסגר ב-{timeConflict.lateStay.closesAt} — אתם יוצאים ב-{timeConflict.lateStay.leavesAt}
                        </span>
                      </div>
                    )}

                    {/* Address */}
                    {!!place.address && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-xs">📍</span>
                        <span className="text-xs text-zinc-600 dark:text-zinc-300">{place.address}</span>
                      </div>
                    )}

                    {/* Phone */}
                    {!!place.phone && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">📞</span>
                        <a
                          href={`tel:${place.phone}`}
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {place.phone}
                        </a>
                      </div>
                    )}

                    {/* Website */}
                    {!!place.website && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">🌐</span>
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {getHostname(place.website)}
                        </a>
                      </div>
                    )}

                    {/* Google Maps link */}
                    {!!place.googlePlaceId && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">🗺️</span>
                        <a
                          href={`https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          הצג בגוגל מפות
                        </a>
                      </div>
                    )}

                    {/* Opening hours */}
                    {!!place.openingHours && (
                      <OpeningHoursSection openingHours={place.openingHours} />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => setIsEditing(true)}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
              title={"\u05E2\u05E8\u05D9\u05DB\u05D4"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(activity.id)}
              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
              title={"\u05DE\u05D7\u05D9\u05E7\u05D4"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Travel time to next */}
      {activity.travelTimeToNextMinutes != null &&
        activity.travelTimeToNextMinutes > 0 && (
          <div className="mt-2 flex items-center gap-1 border-t border-zinc-100 pt-2 text-xs text-zinc-400 dark:border-zinc-700">
            <span>{"\u{1F697}"}</span>
            <span>
              {activity.travelTimeToNextMinutes} {"\u05D3\u05E7\u05D5\u05EA \u05E0\u05E1\u05D9\u05E2\u05D4"}
            </span>
          </div>
        )}
    </div>
  )
}
