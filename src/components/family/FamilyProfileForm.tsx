"use client"

import { useState } from "react"

const ATTRACTION_TYPES = [
  "טבע",
  "מוזיאונים",
  "פארקי שעשועים",
  "חופים",
  "פארקי מים",
  "חוות",
  "אטרקציות היסטוריות",
]

const FOOD_PREFERENCES = [
  "כשר",
  "צמחוני",
  "טבעוני",
  "ללא גלוטן",
  "ללא אלרגיה לאגוזים",
]

const PACE_OPTIONS = [
  { value: "relaxed", label: "רגוע" },
  { value: "moderate", label: "בינוני" },
  { value: "intensive", label: "אינטנסיבי" },
]

interface FamilyProfileFormProps {
  initialData: {
    attractionTypes: string[]
    foodPreferences: string[]
    noLayovers: boolean
    preferredFlightStart: string | null
    preferredFlightEnd: string | null
    pace: string
  }
}

export function FamilyProfileForm({ initialData }: FamilyProfileFormProps) {
  const [attractionTypes, setAttractionTypes] = useState<string[]>(initialData.attractionTypes)
  const [foodPreferences, setFoodPreferences] = useState<string[]>(initialData.foodPreferences)
  const [noLayovers, setNoLayovers] = useState(initialData.noLayovers)
  const [preferredFlightStart, setPreferredFlightStart] = useState(initialData.preferredFlightStart || "")
  const [preferredFlightEnd, setPreferredFlightEnd] = useState(initialData.preferredFlightEnd || "")
  const [pace, setPace] = useState(initialData.pace)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggleChip = (
    value: string,
    list: string[],
    setList: (v: string[]) => void
  ) => {
    setList(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    )
    setSaved(false)
  }

  const handleSave = async () => {
    setLoading(true)
    setSaved(false)
    try {
      const res = await fetch("/api/family", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attractionTypes,
          foodPreferences,
          noLayovers,
          preferredFlightStart: preferredFlightStart || undefined,
          preferredFlightEnd: preferredFlightEnd || undefined,
          pace,
        }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Attraction Types */}
      <div>
        <label className="mb-2 block text-sm font-semibold">סוגי אטרקציות</label>
        <div className="flex flex-wrap gap-2">
          {ATTRACTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleChip(type, attractionTypes, setAttractionTypes)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                attractionTypes.includes(type)
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Food Preferences */}
      <div>
        <label className="mb-2 block text-sm font-semibold">העדפות אוכל</label>
        <div className="flex flex-wrap gap-2">
          {FOOD_PREFERENCES.map((pref) => (
            <button
              key={pref}
              type="button"
              onClick={() => toggleChip(pref, foodPreferences, setFoodPreferences)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                foodPreferences.includes(pref)
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              }`}
            >
              {pref}
            </button>
          ))}
        </div>
      </div>

      {/* Flight Constraints */}
      <div>
        <label className="mb-2 block text-sm font-semibold">מגבלות טיסה</label>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={noLayovers}
              onChange={(e) => {
                setNoLayovers(e.target.checked)
                setSaved(false)
              }}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="text-sm">ללא עצירות</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">שעת יציאה מועדפת:</span>
            <input
              type="time"
              value={preferredFlightStart}
              onChange={(e) => {
                setPreferredFlightStart(e.target.value)
                setSaved(false)
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            />
            <span className="text-sm text-zinc-500">עד</span>
            <input
              type="time"
              value={preferredFlightEnd}
              onChange={(e) => {
                setPreferredFlightEnd(e.target.value)
                setSaved(false)
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            />
          </div>
        </div>
      </div>

      {/* Pace */}
      <div>
        <label className="mb-2 block text-sm font-semibold">קצב טיול</label>
        <div className="flex gap-3">
          {PACE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                name="pace"
                value={option.value}
                checked={pace === option.value}
                onChange={(e) => {
                  setPace(e.target.value)
                  setSaved(false)
                }}
                className="h-4 w-4 border-zinc-300"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "שומר..." : "שמור"}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            נשמר בהצלחה
          </span>
        )}
      </div>
    </div>
  )
}
