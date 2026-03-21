"use client"

import { useState, useCallback, useEffect } from "react"
import { DayTimeline, type DayPlanData } from "./DayTimeline"

interface Trip {
  id: string
  startDate: string
  endDate: string
  flights: {
    outbound?: {
      arrivalTime?: string
    }
    return?: {
      departureTime?: string
    }
  } | null
  attractions: { id: string; name: string; status: string }[]
  restaurants: { id: string; name: string; status: string }[]
}

interface ScheduleViewProps {
  trip: Trip
}

const dayTypeConfig: Record<string, { label: string; icon: string; accent: string }> = {
  arrival: {
    label: "\u05D9\u05D5\u05DD \u05D4\u05D2\u05E2\u05D4",
    icon: "\u2708\uFE0F",
    accent: "border-green-400 dark:border-green-600",
  },
  departure: {
    label: "\u05D9\u05D5\u05DD \u05D7\u05D6\u05E8\u05D4",
    icon: "\u{1F6EB}",
    accent: "border-orange-400 dark:border-orange-600",
  },
  full_day: {
    label: "\u05D9\u05D5\u05DD \u05DE\u05DC\u05D0",
    icon: "\u2600\uFE0F",
    accent: "border-blue-400 dark:border-blue-600",
  },
}

function formatDayDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  })
}

export function ScheduleView({ trip }: ScheduleViewProps) {
  const [dayPlans, setDayPlans] = useState<DayPlanData[]>([])
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${trip.id}/schedule`)
      if (res.ok) {
        const data = await res.json()
        setDayPlans(data)
        if (data.length > 0 && !activeDay) {
          setActiveDay(data[0].id)
        }
      }
    } catch (error) {
      console.error("Failed to fetch schedule:", error)
    } finally {
      setIsLoading(false)
    }
  }, [trip.id, activeDay])

  useEffect(() => {
    fetchSchedule()
  }, [fetchSchedule])

  async function handleGenerate() {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/trips/${trip.id}/schedule`, {
        method: "POST",
      })
      if (res.ok) {
        const data = await res.json()
        setDayPlans(data)
        if (data.length > 0) {
          setActiveDay(data[0].id)
        }
      }
    } catch (error) {
      console.error("Failed to generate schedule:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (dayPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-200 bg-white p-12 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="text-4xl">{"\u{1F4C5}"}</div>
        <p className="text-zinc-500">{'\u05DC\u05D0 \u05E0\u05D5\u05E6\u05E8 \u05DC\u05D5"\u05D6 \u05E2\u05D3\u05D9\u05D9\u05DF'}</p>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isGenerating ? '\u05D9\u05D5\u05E6\u05E8 \u05DC\u05D5"\u05D6...' : '\u05E6\u05D5\u05E8 \u05DC\u05D5"\u05D6'}
        </button>
      </div>
    )
  }

  const activePlan = dayPlans.find((d) => d.id === activeDay)

  return (
    <div className="flex flex-col gap-4">
      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        {dayPlans.map((day) => {
          const config = dayTypeConfig[day.dayType] ?? dayTypeConfig.full_day
          const isActive = day.id === activeDay

          return (
            <button
              key={day.id}
              onClick={() => setActiveDay(day.id)}
              className={`flex min-w-[100px] flex-col items-center gap-0.5 whitespace-nowrap rounded-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? `bg-white shadow-sm dark:bg-zinc-700 ${config.accent}`
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span>{config.icon}</span>
              <span>{formatDayDate(day.date)}</span>
              <span className="text-[10px] text-zinc-400">{config.label}</span>
            </button>
          )
        })}
      </div>

      {/* Active day timeline */}
      {activePlan && (
        <DayTimeline
          tripId={trip.id}
          dayPlan={activePlan}
          attractions={trip.attractions}
          restaurants={trip.restaurants}
          onUpdate={fetchSchedule}
        />
      )}
    </div>
  )
}
