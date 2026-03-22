"use client"

import { useState } from "react"
import { ActivityCard, type ActivityData } from "./ActivityCard"

interface AttractionOption {
  id: string
  name: string
  status: string
}

interface RestaurantOption {
  id: string
  name: string
  status: string
}

export interface DayPlanData {
  id: string
  date: string
  dayType: string
  activities: ActivityData[]
}

interface DayTimelineProps {
  tripId: string
  dayPlan: DayPlanData
  attractions: AttractionOption[]
  restaurants: RestaurantOption[]
  accommodations: { name: string; address?: string; lat?: number; lng?: number }[]
  onUpdate: () => void
}

const activityTypes = [
  { value: "attraction", label: "\u05D0\u05D8\u05E8\u05E7\u05E6\u05D9\u05D4" },
  { value: "meal", label: "\u05D0\u05E8\u05D5\u05D7\u05D4" },
  { value: "travel", label: "\u05E0\u05E1\u05D9\u05E2\u05D4" },
  { value: "rest", label: "\u05DE\u05E0\u05D5\u05D7\u05D4" },
  { value: "custom", label: "\u05D0\u05D7\u05E8" },
  { value: "lodging", label: "לינה" },
]

export function DayTimeline({
  tripId,
  dayPlan,
  attractions,
  restaurants,
  accommodations,
  onUpdate,
}: DayTimelineProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addType, setAddType] = useState("attraction")
  const [addAttractionId, setAddAttractionId] = useState("")
  const [addRestaurantId, setAddRestaurantId] = useState("")
  const [addAccommodationIdx, setAddAccommodationIdx] = useState("")
  const [addTimeStart, setAddTimeStart] = useState("")
  const [addTimeEnd, setAddTimeEnd] = useState("")
  const [addNotes, setAddNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredAttractions = attractions.filter(
    (a) => a.status === "want" || a.status === "maybe"
  )
  const filteredRestaurants = restaurants.filter(
    (r) => r.status === "want" || r.status === "maybe"
  )

  function sortAndReindex(
    activities: Array<{
      sortOrder: number
      timeStart?: string | null
      timeEnd?: string | null
      type: string
      notes?: string | null
      attractionId?: string | null
      restaurantId?: string | null
      travelTimeToNextMinutes?: number | null
    }>
  ) {
    return [...activities]
      .sort((a, b) => {
        if (!a.timeStart && !b.timeStart) return a.sortOrder - b.sortOrder
        if (!a.timeStart) return 1
        if (!b.timeStart) return -1
        return a.timeStart.localeCompare(b.timeStart)
      })
      .map((a, index) => ({ ...a, sortOrder: index }))
  }

  async function handleAddActivity() {
    setIsSubmitting(true)
    try {
      // For lodging, use accommodation name as notes
      const effectiveNotes =
        addType === "lodging" && addAccommodationIdx !== ""
          ? accommodations[parseInt(addAccommodationIdx)]?.name ?? addNotes
          : addNotes

      const newActivity: {
        sortOrder: number
        timeStart?: string | null
        timeEnd?: string | null
        type: string
        notes?: string | null
        attractionId?: string | null
        restaurantId?: string | null
        travelTimeToNextMinutes?: number | null
      } = {
        sortOrder: 999,
        type: addType,
        timeStart: addTimeStart || null,
        timeEnd: addTimeEnd || null,
        notes: effectiveNotes || null,
        attractionId: addType === "attraction" && addAttractionId ? addAttractionId : null,
        restaurantId: addType === "meal" && addRestaurantId ? addRestaurantId : null,
        travelTimeToNextMinutes: null,
      }

      const existingActivities = dayPlan.activities.map((a) => ({
        sortOrder: a.sortOrder,
        timeStart: a.timeStart,
        timeEnd: a.timeEnd,
        type: a.type,
        notes: a.notes,
        attractionId: a.attractionId,
        restaurantId: a.restaurantId,
        travelTimeToNextMinutes: a.travelTimeToNextMinutes,
      }))

      const allActivities = sortAndReindex([...existingActivities, newActivity])

      const res = await fetch(
        `/api/trips/${tripId}/schedule/${dayPlan.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activities: allActivities }),
        }
      )

      if (res.ok) {
        resetAddForm()
        onUpdate()
      }
    } catch (error) {
      console.error("Failed to add activity:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleEditActivity(
    activity: ActivityData,
    updates: { timeStart?: string; timeEnd?: string; notes?: string }
  ) {
    // Rebuild all activities with the update applied, then re-sort by time
    const updatedActivities = sortAndReindex(
      dayPlan.activities.map((a) => {
        const base = {
          sortOrder: a.sortOrder,
          timeStart: a.timeStart,
          timeEnd: a.timeEnd,
          type: a.type,
          notes: a.notes,
          attractionId: a.attractionId,
          restaurantId: a.restaurantId,
          travelTimeToNextMinutes: a.travelTimeToNextMinutes,
        }
        if (a.id === activity.id) {
          return {
            ...base,
            timeStart: updates.timeStart ?? a.timeStart,
            timeEnd: updates.timeEnd ?? a.timeEnd,
            notes: updates.notes ?? a.notes,
          }
        }
        return base
      })
    )

    try {
      const res = await fetch(
        `/api/trips/${tripId}/schedule/${dayPlan.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activities: updatedActivities }),
        }
      )

      if (res.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error("Failed to update activity:", error)
    }
  }

  async function handleDeleteActivity(activityId: string) {
    try {
      const res = await fetch(
        `/api/trips/${tripId}/schedule/${dayPlan.id}?activityId=${activityId}`,
        { method: "DELETE" }
      )

      if (res.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error("Failed to delete activity:", error)
    }
  }

  function resetAddForm() {
    setShowAddDialog(false)
    setAddType("attraction")
    setAddAttractionId("")
    setAddRestaurantId("")
    setAddAccommodationIdx("")
    setAddTimeStart("")
    setAddTimeEnd("")
    setAddNotes("")
  }

  return (
    <div className="flex flex-col gap-3">
      {dayPlan.activities.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/50">
          <span className="text-sm text-zinc-400">
            {"\u05D0\u05D9\u05DF \u05E4\u05E2\u05D9\u05DC\u05D5\u05D9\u05D5\u05EA \u05DC\u05D9\u05D5\u05DD \u05D6\u05D4. \u05DC\u05D7\u05E6\u05D5 \u05E2\u05DC \"\u05D4\u05D5\u05E1\u05E3 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA\" \u05DB\u05D3\u05D9 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC."}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dayPlan.activities.map((activity, index) => (
            <div key={activity.id} className="flex flex-col gap-2">
              <ActivityCard
                activity={activity}
                onEdit={handleEditActivity}
                onDelete={handleDeleteActivity}
              />
              {/* Travel time indicator between activities */}
              {activity.travelTimeToNextMinutes != null &&
                activity.travelTimeToNextMinutes > 0 &&
                index < dayPlan.activities.length - 1 && (
                  <div className="flex items-center justify-center py-1">
                    <div className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                      <span>{"\u{1F697}"}</span>
                      <span>
                        {activity.travelTimeToNextMinutes}{" "}
                        {"\u05D3\u05E7\u05D5\u05EA \u05E0\u05E1\u05D9\u05E2\u05D4"}
                      </span>
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      {/* Add Activity */}
      {!showAddDialog ? (
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-zinc-600 dark:hover:border-blue-500"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {"\u05D4\u05D5\u05E1\u05E3 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA"}
        </button>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h4 className="mb-3 text-sm font-semibold">{"\u05D4\u05D5\u05E1\u05E4\u05EA \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA"}</h4>

          <div className="flex flex-col gap-3">
            {/* Type selection */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">{"\u05E1\u05D5\u05D2"}</label>
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              >
                {activityTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Attraction dropdown */}
            {addType === "attraction" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">{"\u05D0\u05D8\u05E8\u05E7\u05E6\u05D9\u05D4"}</label>
                <select
                  value={addAttractionId}
                  onChange={(e) => setAddAttractionId(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">{"\u05D1\u05D7\u05E8\u05D5 \u05D0\u05D8\u05E8\u05E7\u05E6\u05D9\u05D4..."}</option>
                  {filteredAttractions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Restaurant dropdown */}
            {addType === "meal" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">{"\u05DE\u05E1\u05E2\u05D3\u05D4"}</label>
                <select
                  value={addRestaurantId}
                  onChange={(e) => setAddRestaurantId(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">{"\u05D1\u05D7\u05E8\u05D5 \u05DE\u05E1\u05E2\u05D3\u05D4..."}</option>
                  {filteredRestaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Accommodation dropdown */}
            {addType === "lodging" && accommodations.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">{"לינה"}</label>
                <select
                  value={addAccommodationIdx}
                  onChange={(e) => {
                    setAddAccommodationIdx(e.target.value)
                    if (e.target.value !== "") {
                      const acc = accommodations[parseInt(e.target.value)]
                      if (acc) setAddNotes(acc.name)
                    }
                  }}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">{"בחרו לינה..."}</option>
                  {accommodations.map((acc, idx) => (
                    <option key={idx} value={idx}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Time inputs */}
            <div className="flex gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">{"\u05E9\u05E2\u05EA \u05D4\u05EA\u05D7\u05DC\u05D4"}</label>
                <input
                  type="time"
                  value={addTimeStart}
                  onChange={(e) => setAddTimeStart(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">{"\u05E9\u05E2\u05EA \u05E1\u05D9\u05D5\u05DD"}</label>
                <input
                  type="time"
                  value={addTimeEnd}
                  onChange={(e) => setAddTimeEnd(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">{"\u05D4\u05E2\u05E8\u05D5\u05EA"}</label>
              <input
                type="text"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder={"\u05D4\u05E2\u05E8\u05D5\u05EA..."}
                className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleAddActivity}
                disabled={isSubmitting}
                className="rounded bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? "\u05E9\u05D5\u05DE\u05E8..." : "\u05D4\u05D5\u05E1\u05E3"}
              </button>
              <button
                onClick={resetAddForm}
                className="rounded border border-zinc-300 px-4 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-700"
              >
                {"\u05D1\u05D9\u05D8\u05D5\u05DC"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
