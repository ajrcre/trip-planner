"use client"

import { useState } from "react"
import {
  parseDayHours,
  DAY_NAMES_EN,
  DAY_NAMES_HE,
  formatAmPmTimesInText,
} from "@/lib/time-parsing"

export function OpeningHoursSection({ openingHours, scheduleDate }: { openingHours: unknown; scheduleDate?: string }) {
  const [showAll, setShowAll] = useState(false)
  const allHours = parseDayHours(openingHours)
  const targetDate = scheduleDate ? new Date(scheduleDate) : new Date()
  // Use getUTCDay for schedule dates (ISO strings) to avoid timezone shifts
  const dayIndex = scheduleDate ? targetDate.getUTCDay() : targetDate.getDay()
  const todayNameEn = DAY_NAMES_EN[dayIndex]
  const todayNameHe = DAY_NAMES_HE[todayNameEn]
  const today = allHours.find((h) => h.dayName === todayNameEn || h.dayName === todayNameHe) ?? null

  if (!today && allHours.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs">🕐</span>
        {today ? (
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {scheduleDate ? "" : "היום ("}{DAY_NAMES_HE[today.dayName] ?? today.dayName}{scheduleDate ? "" : ")"}:{" "}
            {today.hours ? formatAmPmTimesInText(today.hours) : "סגור"}
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
                    h.dayName === todayNameEn || h.dayName === todayNameHe
                      ? "font-semibold text-zinc-700 dark:text-zinc-200"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {DAY_NAMES_HE[h.dayName] ?? h.dayName}:{" "}
                  {h.hours ? formatAmPmTimesInText(h.hours) : "סגור"}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
