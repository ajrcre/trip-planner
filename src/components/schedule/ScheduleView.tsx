"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { DayTimeline, type DayPlanData } from "./DayTimeline"
import { CopyToWhatsAppButton } from "./CopyToWhatsAppButton"
import { ItineraryMap } from "./ItineraryMap"

import { WeatherForecast } from "./WeatherForecast"
import type { DailyWeather, HourlyWeather } from "@/lib/weather"
import { normalizeAccommodations, getAccommodationsForDay } from "@/lib/accommodations"
import { normalizeCarRentals, normalizeFlights } from "@/lib/normalizers"

interface Trip {
  id: string
  startDate: string
  endDate: string
  accommodation: unknown
  flights: unknown
  carRental: unknown
  attractions: { id: string; name: string; status: string }[]
  restaurants: { id: string; name: string; status: string }[]
  groceryStores: { id: string; name: string; status: string }[]
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

interface WeatherResponse {
  daily: DailyWeather[]
  hourly: HourlyWeather[]
  forecastAvailableUntil: string
}

function isWithinTwoWeeks(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  return diffMs < 14 * 24 * 60 * 60 * 1000
}

function normalizeDate(dateStr: string): string {
  return new Date(dateStr).toISOString().split("T")[0]
}

export function ScheduleView({ trip }: ScheduleViewProps) {
  const [dayPlans, setDayPlans] = useState<DayPlanData[]>([])
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null)
  const [isWeatherLoading, setIsWeatherLoading] = useState(true)
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null)


  const handleMarkerClick = useCallback((activityId: string) => {
    setActiveActivityId(activityId)
    const el = document.getElementById(`activity-${activityId}`)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

  // Fetch weather data
  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(`/api/trips/${trip.id}/weather`)
        if (res.ok) {
          const data = await res.json()
          setWeatherData(data)
        }
      } catch {
        // Weather is supplementary — fail silently
      } finally {
        setIsWeatherLoading(false)
      }
    }
    fetchWeather()
  }, [trip.id])

  // Map date -> daily weather for quick lookup
  const weatherByDate = useMemo(() => {
    const map = new Map<string, DailyWeather>()
    if (weatherData?.daily) {
      for (const d of weatherData.daily) {
        map.set(d.date, d)
      }
    }
    return map
  }, [weatherData])

  // Map date -> hourly weather
  const hourlyByDate = useMemo(() => {
    const map = new Map<string, HourlyWeather[]>()
    if (weatherData?.hourly) {
      for (const h of weatherData.hourly) {
        const date = h.time.split("T")[0]
        if (!map.has(date)) map.set(date, [])
        map.get(date)!.push(h)
      }
    }
    return map
  }, [weatherData])

  const accommodations = useMemo(() => normalizeAccommodations(trip.accommodation), [trip.accommodation])

  const flightLegs = useMemo(() => normalizeFlights(trip.flights), [trip.flights])
  const carRentals = useMemo(() => normalizeCarRentals(trip.carRental), [trip.carRental])
  const accommodationOptions = useMemo(
    () =>
      accommodations.map((a, index) => ({
        index,
        name: a.name ?? "לינה",
      })),
    [accommodations]
  )

  const accommodationsFullForMap = useMemo(
    () =>
      accommodations.map((a) => ({
        name: a.name ?? "לינה",
        lat: a.coordinates?.lat,
        lng: a.coordinates?.lng,
      })),
    [accommodations]
  )

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${trip.id}/schedule`)
      if (res.ok) {
        const data = await res.json()
        setDayPlans(data)
        setActiveDay((prev) => {
          if (prev) return prev
          return data.length > 0 ? data[0].id : null
        })
      }
    } catch (error) {
      console.error("Failed to fetch schedule:", error)
    } finally {
      setIsLoading(false)
    }
  }, [trip.id])

  useEffect(() => {
    fetchSchedule()
  }, [fetchSchedule])

  // Listen for schedule updates from the global AI chat
  useEffect(() => {
    const handler = () => fetchSchedule()
    window.addEventListener("schedule-updated", handler)
    return () => window.removeEventListener("schedule-updated", handler)
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

  const activeDayAccommodations = activePlan
    ? getAccommodationsForDay(accommodations, normalizeDate(activePlan.date)).map(
        ({ accommodation }) => ({
          name: accommodation.name ?? "לינה",
          address: accommodation.address,
          lat: accommodation.coordinates?.lat,
          lng: accommodation.coordinates?.lng,
        })
      )
    : []

  const mapAccommodations = activeDayAccommodations.map((a) => ({
    name: a.name,
    lat: a.lat,
    lng: a.lng,
  }))

  const allDayPlansForMap = dayPlans.map((dp) => ({
    id: dp.id,
    date: dp.date,
    activities: dp.activities,
  }))

  return (
    <div className="flex flex-col gap-4">
      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        {dayPlans.map((day) => {
          const config = dayTypeConfig[day.dayType] ?? dayTypeConfig.full_day
          const isActive = day.id === activeDay
          const dayWeather = weatherByDate.get(normalizeDate(day.date))

          return (
            <button
              key={day.id}
              onClick={() => setActiveDay(day.id)}
              className={`flex min-w-[110px] flex-col items-center gap-0.5 whitespace-nowrap rounded-lg border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? `bg-white shadow-sm dark:bg-zinc-700 ${config.accent}`
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <span>{config.icon}</span>
              <span>{formatDayDate(day.date)}</span>
              <span className="text-[10px] text-zinc-400">{config.label}</span>
              {dayWeather && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {dayWeather.condition.icon} {dayWeather.temperatureMax}°
                </span>
              )}
              {(() => {
                const dayAccs = getAccommodationsForDay(accommodations, day.date)
                if (dayAccs.length === 0) return null
                return dayAccs.map(({ accommodation: a, status }, i) => (
                  <span key={i} className="text-[10px] text-blue-500 dark:text-blue-400 truncate max-w-[100px]">
                    🏨 {status === "check-in" ? "כניסה: " : status === "check-out" ? "יציאה: " : ""}{a.name || "לינה"}
                  </span>
                ))
              })()}
            </button>
          )
        })}
      </div>

      {/* Split panel: map (left) + timeline (right) */}
      <div className="flex flex-col lg:flex-row-reverse gap-4">
        {/* Map panel (left side on desktop) */}
        <div className="order-last lg:order-first lg:max-w-[45%] lg:min-w-[45%] lg:sticky lg:top-4 lg:self-start">
          {activePlan && (
            <ItineraryMap
              activities={activePlan.activities}
              allDayPlans={allDayPlansForMap}
              activeActivityId={activeActivityId}
              onMarkerClick={handleMarkerClick}
              accommodations={mapAccommodations}
              accommodationsFull={accommodationsFullForMap}
            />
          )}
        </div>

        {/* Timeline panel (right side on desktop) */}
        <div className="flex-1 lg:max-w-[55%] flex flex-col gap-4">
          {/* Weather forecast for active day */}
          {activePlan && (
            <WeatherForecast
              dailyWeather={weatherByDate.get(normalizeDate(activePlan.date)) ?? null}
              hourlyWeather={hourlyByDate.get(normalizeDate(activePlan.date)) ?? null}
              isNearDate={isWithinTwoWeeks(activePlan.date)}
              isLoading={isWeatherLoading}
            />
          )}

          {/* WhatsApp copy button */}
          {activePlan && activePlan.activities.length > 0 && (
            <div className="flex justify-end">
              <CopyToWhatsAppButton dayPlan={activePlan} tripAccommodations={accommodations} />
            </div>
          )}

          {/* Active day timeline */}
          {activePlan && (
            <DayTimeline
              tripId={trip.id}
              dayPlan={activePlan}
              attractions={trip.attractions}
              restaurants={trip.restaurants}
              groceryStores={trip.groceryStores}
              accommodations={activeDayAccommodations}
              tripAccommodations={accommodations}
              accommodationOptions={accommodationOptions}
              flightLegs={flightLegs}
              carRentals={carRentals}
              onUpdate={fetchSchedule}
              activeActivityId={activeActivityId}
              onActivityHover={setActiveActivityId}
            />
          )}

        </div>

      </div>

    </div>
  )
}
