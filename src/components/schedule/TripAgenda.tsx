"use client"

import { useState } from "react"
import type { DayPlanData } from "./DayTimeline"
import type { ActivityData } from "./ActivityCard"
import type { DailyWeather } from "@/lib/weather"
import { type Accommodation, getAccommodationsForDay } from "@/lib/accommodations"
import { googleMapsUrl } from "@/lib/url-helpers"
import { TextWithLinks } from "@/components/shared/TextWithLinks"
import {
  dayTypeConfig,
  formatDayDate,
  activityPlace,
  activityDisplay,
} from "@/lib/schedule-display"

interface TripAgendaProps {
  dayPlans: DayPlanData[]
  weatherByDate: Map<string, DailyWeather>
  accommodations: Accommodation[]
  /** Switch back to the single-day view, focused on this day. */
  onSelectDay: (dayId: string) => void
}

function normalizeDate(dateStr: string): string {
  return new Date(dateStr).toISOString().split("T")[0]
}

/** The headline text for an activity row — mirrors ActivityCard's `name`. */
function activityName(activity: ActivityData, accommodations: Accommodation[]): string | null {
  if (
    activity.type === "travel" &&
    activity.travelLeg?.resolvedOrigin &&
    activity.travelLeg?.resolvedDestination
  ) {
    return `${activity.travelLeg.resolvedOrigin.label} → ${activity.travelLeg.resolvedDestination.label}`
  }
  const restAccommodation =
    (activity.type === "rest" || activity.type === "meal") &&
    activity.restAccommodationIndex != null
      ? accommodations[activity.restAccommodationIndex]
      : undefined
  if (activity.type === "rest" && restAccommodation?.name) {
    return `מנוחה — ${restAccommodation.name}`
  }
  if (activity.type === "meal" && !activity.restaurant && restAccommodation?.name) {
    return restAccommodation.name
  }
  const place = activityPlace(activity)
  if (place) return place.name
  return null
}

function ActivityRow({
  activity,
  accommodations,
}: {
  activity: ActivityData
  accommodations: Accommodation[]
}) {
  const { icon, label } = activityDisplay(activity)
  const place = activityPlace(activity)
  const name = activityName(activity, accommodations)
  // When there is no place, the notes double as the title (as in ActivityCard),
  // so they must not also be repeated underneath.
  const nameIsNotes = !name && !!activity.notes
  const timeText = activity.timeStart
    ? `${activity.timeStart}${activity.timeEnd ? `–${activity.timeEnd}` : ""}`
    : null

  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:items-baseline sm:gap-3">
      {/* Line 1 on mobile: time + type. Fixed column from sm: up. */}
      <div className="flex shrink-0 items-baseline gap-2 sm:w-40">
        {/*
          `dir="ltr"` is required: in the RTL page the en-dash is a neutral
          character, so "08:00–09:00" would otherwise be reordered on screen to
          "09:00–08:00" and read as starting at the end time.
        */}
        <span
          dir="ltr"
          className="whitespace-nowrap font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
        >
          {timeText ?? "—"}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          <span aria-hidden="true">{icon}</span> {label}
        </span>
      </div>

      {/* Line 2 on mobile: the name, free to wrap onto as many lines as it needs. */}
      <div className="min-w-0 flex-1">
        {nameIsNotes ? (
          <TextWithLinks text={activity.notes!} className="text-sm font-medium break-words" />
        ) : (
          name && (
            <>
              {place ? (
                <a
                  href={googleMapsUrl(place.name, place)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium break-words text-blue-700 hover:underline dark:text-blue-400"
                >
                  {name}
                </a>
              ) : (
                <span className="text-sm font-medium break-words">{name}</span>
              )}
            </>
          )
        )}
        {!nameIsNotes && activity.notes && (
          <TextWithLinks
            text={activity.notes}
            className="mt-0.5 text-xs break-words text-zinc-500 dark:text-zinc-400"
          />
        )}
      </div>
    </div>
  )
}

export function TripAgenda({
  dayPlans,
  weatherByDate,
  accommodations,
  onSelectDay,
}: TripAgendaProps) {
  const [attractionsOnly, setAttractionsOnly] = useState(false)

  const attractionCount = dayPlans.reduce(
    (sum, day) => sum + day.activities.filter((a) => a.type === "attraction").length,
    0
  )

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer select-none items-center gap-2 self-start text-xs text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={attractionsOnly}
          onChange={(e) => setAttractionsOnly(e.target.checked)}
          className="h-4 w-4 accent-blue-600"
        />
        רק אטרקציות
        <span className="text-zinc-400 dark:text-zinc-500">({attractionCount})</span>
      </label>

      {dayPlans.map((day) => {
        const config = dayTypeConfig[day.dayType] ?? dayTypeConfig.full_day
        const dayWeather = weatherByDate.get(normalizeDate(day.date))
        const dayAccommodations = getAccommodationsForDay(accommodations, day.date)
        const activities = attractionsOnly
          ? day.activities.filter((a) => a.type === "attraction")
          : day.activities

        return (
          <section
            key={day.id}
            className={`rounded-xl border border-zinc-200 border-e-4 bg-white dark:border-zinc-700 dark:bg-zinc-800 ${config.accent}`}
          >
            {/*
              Day header — tappable, returns to the single-day view.
              Deliberately not `sticky`: globals.css sets `overflow-x: hidden` on
              body, which forces `overflow-y` to compute to `auto`. That makes
              body a scrollport that never actually scrolls (html is the
              scroller), so a sticky child resolves against it and never pins.
            */}
            <button
              onClick={() => onSelectDay(day.id)}
              className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-t-xl border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-start hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-700"
            >
              <span className="text-sm font-semibold">
                <span aria-hidden="true">{config.icon}</span> {formatDayDate(day.date)}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{config.label}</span>
              {dayWeather && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span aria-hidden="true">{dayWeather.condition.icon}</span>{" "}
                  {dayWeather.temperatureMax}°
                </span>
              )}
              {dayAccommodations.map(({ accommodation, status }, i) => (
                <span
                  key={i}
                  className="max-w-[45%] truncate text-xs text-blue-500 dark:text-blue-400"
                >
                  <span aria-hidden="true">🏨</span>{" "}
                  {status === "check-in" ? "כניסה: " : status === "check-out" ? "יציאה: " : ""}
                  {accommodation.name || "לינה"}
                </span>
              ))}
            </button>

            <div className="flex flex-col px-3 py-2 sm:px-4">
              {day.notes && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-900/20">
                  <span className="text-sm text-amber-600 dark:text-amber-400" aria-hidden="true">
                    📌
                  </span>
                  <TextWithLinks
                    text={day.notes}
                    className="min-w-0 flex-1 text-xs break-words text-amber-800 dark:text-amber-300"
                  />
                </div>
              )}

              {activities.length === 0 ? (
                <span className="py-2 text-xs text-zinc-400">
                  {attractionsOnly ? "אין אטרקציות" : "אין פעילויות"}
                </span>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-700/60">
                  {activities.map((activity, index) => (
                    <div key={activity.id}>
                      <ActivityRow activity={activity} accommodations={accommodations} />
                      {/*
                        Travel times are the gap to the *next* activity in the full
                        day, so they are meaningless once rows in between are
                        filtered out — hide them entirely in attractions-only mode.
                      */}
                      {!attractionsOnly &&
                        activity.travelTimeToNextMinutes != null &&
                        activity.travelTimeToNextMinutes > 0 &&
                        index < activities.length - 1 && (
                          <div className="pb-1.5 sm:ps-40">
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                              <span aria-hidden="true">{"\u{1F697}"}</span>
                              {activity.travelTimeToNextMinutes} דקות נסיעה
                            </span>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
