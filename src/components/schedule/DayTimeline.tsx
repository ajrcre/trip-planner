"use client"

import { useMemo, useState } from "react"
import type { Accommodation } from "@/lib/accommodations"
import type { CarRental, FlightLeg } from "@/lib/normalizers"
import { decodeTravelEndpoint, encodeTravelEndpoint } from "@/lib/travel-endpoint-codec"
import type { TravelEndpointRef } from "@/types/travel-leg"
import { ActivityCard, type ActivityData } from "./ActivityCard"
import { supportsAlternatives, alternativePlanLabel } from "@/lib/activity-alternatives"

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

interface GroceryStoreOption {
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

interface AccommodationOption {
  index: number
  name: string
}

interface AltDraft {
  attractionId: string
  restaurantId: string
  groceryStoreId: string
  notes: string
}

interface DayTimelineProps {
  tripId: string
  dayPlan: DayPlanData
  attractions: AttractionOption[]
  restaurants: RestaurantOption[]
  groceryStores: GroceryStoreOption[]
  accommodations: { name: string; address?: string; lat?: number; lng?: number }[]
  /** Full normalized trip accommodations (indices match `accommodationOptions` and rest) */
  tripAccommodations: Accommodation[]
  /** Full trip accommodation list (indices match server `lodging` travel endpoints) */
  accommodationOptions: AccommodationOption[]
  flightLegs: FlightLeg[]
  carRentals: CarRental[]
  onUpdate: () => void | Promise<void>
  activeActivityId?: string | null
  onActivityHover?: (activityId: string | null) => void
}

const activityTypes = [
  { value: "attraction", label: "\u05D0\u05D8\u05E8\u05E7\u05E6\u05D9\u05D4" },
  { value: "meal", label: "\u05D0\u05E8\u05D5\u05D7\u05D4" },
  { value: "travel", label: "\u05E0\u05E1\u05D9\u05E2\u05D4" },
  { value: "rest", label: "\u05DE\u05E0\u05D5\u05D7\u05D4" },
  { value: "grocery", label: "קניות מכולת" },
  { value: "custom", label: "\u05D0\u05D7\u05E8" },
  { value: "lodging", label: "לינה" },
]

type ActivityPayloadItem = {
  sortOrder: number
  timeStart?: string | null
  timeEnd?: string | null
  type: string
  notes?: string | null
  attractionId?: string | null
  restaurantId?: string | null
  groceryStoreId?: string | null
  restAccommodationIndex?: number | null
  travelTimeToNextMinutes?: number | null
  travelLeg?: { origin: TravelEndpointRef; destination: TravelEndpointRef } | null
  alternatives?: Array<{
    priority: number
    attractionId?: string | null
    restaurantId?: string | null
    groceryStoreId?: string | null
    notes?: string | null
  }> | null
}

export function DayTimeline({
  tripId,
  dayPlan,
  attractions,
  restaurants,
  groceryStores,
  accommodations,
  tripAccommodations,
  accommodationOptions,
  flightLegs,
  carRentals,
  onUpdate,
  activeActivityId,
  onActivityHover,
}: DayTimelineProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addType, setAddType] = useState("attraction")
  const [addAttractionId, setAddAttractionId] = useState("")
  const [addRestaurantId, setAddRestaurantId] = useState("")
  const [addGroceryStoreId, setAddGroceryStoreId] = useState("")
  const [addAccommodationIdx, setAddAccommodationIdx] = useState("")
  const [addRestAccommodationIdx, setAddRestAccommodationIdx] = useState("")
  const [addTimeStart, setAddTimeStart] = useState("")
  const [addTimeEnd, setAddTimeEnd] = useState("")
  const [addNotes, setAddNotes] = useState("")
  const [addTravelOrigin, setAddTravelOrigin] = useState("")
  const [addTravelDest, setAddTravelDest] = useState("")
  const [addAlternatives, setAddAlternatives] = useState<AltDraft[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filteredAttractions = attractions.filter(
    (a) => a.status === "want" || a.status === "maybe"
  )
  const filteredRestaurants = restaurants.filter(
    (r) => r.status === "want" || r.status === "maybe"
  )
  const filteredGroceryStores = groceryStores.filter(
    (g) => g.status === "want" || g.status === "maybe"
  )

  const travelEndpointRows = useMemo(() => {
    const rows: { value: string; label: string }[] = []
    for (const a of filteredAttractions) {
      rows.push({
        value: encodeTravelEndpoint({ kind: "attraction", id: a.id }),
        label: `אטרקציה: ${a.name}`,
      })
    }
    for (const r of filteredRestaurants) {
      rows.push({
        value: encodeTravelEndpoint({ kind: "restaurant", id: r.id }),
        label: `מסעדה: ${r.name}`,
      })
    }
    for (const g of filteredGroceryStores) {
      rows.push({
        value: encodeTravelEndpoint({ kind: "groceryStore", id: g.id }),
        label: `מכולת: ${g.name}`,
      })
    }
    for (const opt of accommodationOptions) {
      rows.push({
        value: encodeTravelEndpoint({
          kind: "lodging",
          accommodationIndex: opt.index,
        }),
        label: `לינה: ${opt.name}`,
      })
    }
    const outbound = flightLegs[0]
    if (outbound) {
      if (outbound.departureAirport) {
        rows.push({
          value: encodeTravelEndpoint({
            kind: "flight",
            leg: "outbound",
            point: "departure",
          }),
          label: `טיסה הלוך — המראה (${outbound.departureAirport})`,
        })
      }
      if (outbound.arrivalAirport) {
        rows.push({
          value: encodeTravelEndpoint({
            kind: "flight",
            leg: "outbound",
            point: "arrival",
          }),
          label: `טיסה הלוך — נחיתה (${outbound.arrivalAirport})`,
        })
      }
    }
    const ret = flightLegs[1]
    if (ret) {
      if (ret.departureAirport) {
        rows.push({
          value: encodeTravelEndpoint({
            kind: "flight",
            leg: "return",
            point: "departure",
          }),
          label: `טיסה חזור — המראה (${ret.departureAirport})`,
        })
      }
      if (ret.arrivalAirport) {
        rows.push({
          value: encodeTravelEndpoint({
            kind: "flight",
            leg: "return",
            point: "arrival",
          }),
          label: `טיסה חזור — נחיתה (${ret.arrivalAirport})`,
        })
      }
    }
    carRentals.forEach((cr, rentalIndex) => {
      if (cr.pickupLocation) {
        rows.push({
          value: encodeTravelEndpoint({
            kind: "carRental",
            rentalIndex,
            point: "pickup",
          }),
          label: `רכב — איסוף${cr.company ? ` (${cr.company})` : ""}`,
        })
      }
      if (cr.returnLocation) {
        rows.push({
          value: encodeTravelEndpoint({
            kind: "carRental",
            rentalIndex,
            point: "return",
          }),
          label: `רכב — החזרה${cr.company ? ` (${cr.company})` : ""}`,
        })
      }
    })
    return rows
  }, [
    filteredAttractions,
    filteredRestaurants,
    filteredGroceryStores,
    accommodationOptions,
    flightLegs,
    carRentals,
  ])

  function sortAndReindex(activities: ActivityPayloadItem[]): ActivityPayloadItem[] {
    return [...activities]
      .sort((a, b) => {
        if (!a.timeStart && !b.timeStart) return a.sortOrder - b.sortOrder
        if (!a.timeStart) return 1
        if (!b.timeStart) return -1
        return a.timeStart.localeCompare(b.timeStart)
      })
      .map((a, index) => ({ ...a, sortOrder: index }))
  }

  /** Build a payload item from an existing ActivityData, preserving alternatives. */
  function activityToPayload(a: ActivityData): ActivityPayloadItem {
    return {
      sortOrder: a.sortOrder,
      timeStart: a.timeStart,
      timeEnd: a.timeEnd,
      type: a.type,
      notes: a.notes,
      attractionId: a.attractionId,
      restaurantId: a.restaurantId,
      groceryStoreId: a.groceryStoreId,
      restAccommodationIndex: a.restAccommodationIndex ?? null,
      travelTimeToNextMinutes: a.travelTimeToNextMinutes,
      travelLeg:
        a.type === "travel" && a.travelLeg
          ? { origin: a.travelLeg.origin, destination: a.travelLeg.destination }
          : null,
      alternatives: a.alternatives?.map((alt, i) => ({
        priority: i,
        notes: alt.notes,
        attractionId: alt.attractionId,
        restaurantId: alt.restaurantId,
        groceryStoreId: alt.groceryStoreId,
      })) ?? null,
    }
  }

  async function putActivities(activities: ActivityPayloadItem[]) {
    return fetch(`/api/trips/${tripId}/schedule/${dayPlan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activities }),
    })
  }

  async function handleAddActivity() {
    setIsSubmitting(true)
    try {
      let travelLeg: { origin: TravelEndpointRef; destination: TravelEndpointRef } | null =
        null
      if (addType === "travel") {
        const o = decodeTravelEndpoint(addTravelOrigin)
        const d = decodeTravelEndpoint(addTravelDest)
        if (!o || !d) {
          window.alert("בחרו נקודת מוצא ויעד לנסיעה")
          setIsSubmitting(false)
          return
        }
        if (encodeTravelEndpoint(o) === encodeTravelEndpoint(d)) {
          window.alert("מקור ויעד חייבים להיות שונים")
          setIsSubmitting(false)
          return
        }
        travelLeg = { origin: o, destination: d }
      }

      if (addType === "rest") {
        if (accommodationOptions.length === 0) {
          window.alert("הוסיפו לינה בסקירת הטיול לפני רישום מנוחה")
          setIsSubmitting(false)
          return
        }
        if (addRestAccommodationIdx === "") {
          window.alert("בחרו לינה למנוחה")
          setIsSubmitting(false)
          return
        }
      }

      // For lodging, use accommodation name as notes
      const effectiveNotes =
        addType === "lodging" && addAccommodationIdx !== ""
          ? accommodations[parseInt(addAccommodationIdx)]?.name ?? addNotes
          : addNotes

      // Build alternatives payload from draft rows
      const alternativesPayload: ActivityPayloadItem["alternatives"] =
        supportsAlternatives(addType)
          ? addAlternatives
              .map((alt, i) => ({
                priority: i,
                notes: alt.notes || null,
                attractionId: addType === "attraction" && alt.attractionId ? alt.attractionId : null,
                restaurantId: addType === "meal" && alt.restaurantId ? alt.restaurantId : null,
                groceryStoreId: addType === "grocery" && alt.groceryStoreId ? alt.groceryStoreId : null,
              }))
              .filter((alt) => alt.attractionId || alt.restaurantId || alt.groceryStoreId)
          : null

      const newActivity: ActivityPayloadItem = {
        sortOrder: 999,
        type: addType,
        timeStart: addTimeStart || null,
        timeEnd: addTimeEnd || null,
        notes: effectiveNotes || null,
        attractionId: addType === "attraction" && addAttractionId ? addAttractionId : null,
        restaurantId: addType === "meal" && addRestaurantId ? addRestaurantId : null,
        groceryStoreId: addType === "grocery" && addGroceryStoreId ? addGroceryStoreId : null,
        restAccommodationIndex:
          (addType === "rest" || addType === "meal") && addRestAccommodationIdx !== ""
            ? parseInt(addRestAccommodationIdx, 10)
            : null,
        travelTimeToNextMinutes: null,
        travelLeg,
        alternatives: alternativesPayload,
      }

      const existingActivities = dayPlan.activities.map(activityToPayload)
      const allActivities = sortAndReindex([...existingActivities, newActivity])

      const res = await putActivities(allActivities)

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
    updates: {
      timeStart?: string
      timeEnd?: string
      notes?: string
      travelLeg?: { origin: TravelEndpointRef; destination: TravelEndpointRef } | null
      restAccommodationIndex?: number | null
    }
  ) {
    const updatedActivities = sortAndReindex(
      dayPlan.activities.map((a) => {
        const base = activityToPayload(a)
        if (a.id === activity.id) {
          return {
            ...base,
            timeStart: updates.timeStart ?? a.timeStart,
            timeEnd: updates.timeEnd ?? a.timeEnd,
            notes: updates.notes ?? a.notes,
            travelLeg:
              updates.travelLeg !== undefined
                ? updates.travelLeg
                : base.travelLeg,
            restAccommodationIndex:
              updates.restAccommodationIndex !== undefined
                ? updates.restAccommodationIndex
                : base.restAccommodationIndex,
          }
        }
        return base
      })
    )

    try {
      const res = await putActivities(updatedActivities)
      if (res.ok) {
        await onUpdate()
      }
    } catch (error) {
      console.error("Failed to update activity:", error)
    }
  }

  async function handleDeleteActivity(activityId: string) {
    setDeletingId(activityId)
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
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRemoveAlternative(activityId: string, alternativeId: string) {
    const updatedActivities = sortAndReindex(
      dayPlan.activities.map((a) => {
        const base = activityToPayload(a)
        if (a.id !== activityId) return base
        const filtered = (a.alternatives ?? [])
          .filter((alt) => alt.id !== alternativeId)
          .map((alt, i) => ({
            priority: i,
            notes: alt.notes,
            attractionId: alt.attractionId,
            restaurantId: alt.restaurantId,
            groceryStoreId: alt.groceryStoreId,
          }))
        return { ...base, alternatives: filtered }
      })
    )
    const res = await putActivities(updatedActivities)
    if (res.ok) await onUpdate()
  }

  async function handleAddAlternative(activityId: string, placeId: string, notes: string) {
    const activity = dayPlan.activities.find((a) => a.id === activityId)
    if (!activity) return

    const existingAlts = activity.alternatives ?? []
    const newAlt = {
      priority: existingAlts.length,
      notes: notes || null,
      attractionId: activity.type === "attraction" ? placeId : null,
      restaurantId: activity.type === "meal" ? placeId : null,
      groceryStoreId: activity.type === "grocery" ? placeId : null,
    }

    const updatedActivities = sortAndReindex(
      dayPlan.activities.map((a) => {
        const base = activityToPayload(a)
        if (a.id !== activityId) return base
        return {
          ...base,
          alternatives: [
            ...(base.alternatives ?? []),
            newAlt,
          ],
        }
      })
    )
    const res = await putActivities(updatedActivities)
    if (res.ok) await onUpdate()
  }

  function resetAddForm() {
    setShowAddDialog(false)
    setAddType("attraction")
    setAddAttractionId("")
    setAddRestaurantId("")
    setAddGroceryStoreId("")
    setAddAccommodationIdx("")
    setAddRestAccommodationIdx("")
    setAddTravelOrigin("")
    setAddTravelDest("")
    setAddTimeStart("")
    setAddTimeEnd("")
    setAddNotes("")
    setAddAlternatives([])
  }

  function addAltRow() {
    setAddAlternatives((prev) => [
      ...prev,
      { attractionId: "", restaurantId: "", groceryStoreId: "", notes: "" },
    ])
  }

  function updateAltRow(index: number, field: keyof AltDraft, value: string) {
    setAddAlternatives((prev) =>
      prev.map((alt, i) => (i === index ? { ...alt, [field]: value } : alt))
    )
  }

  function removeAltRow(index: number) {
    setAddAlternatives((prev) => prev.filter((_, i) => i !== index))
  }

  /** Returns alternative options for a given activity (for card inline add) */
  function altOptionsForActivity(activity: ActivityData) {
    if (activity.type === "attraction") return filteredAttractions
    if (activity.type === "meal") return filteredRestaurants
    if (activity.type === "grocery") return filteredGroceryStores
    return []
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
            <div
              key={activity.id}
              id={`activity-${activity.id}`}
              className={`flex flex-col gap-2 transition-all ${
                activeActivityId === activity.id ? "ring-2 ring-blue-400 rounded-lg" : ""
              } ${deletingId === activity.id ? "pointer-events-none opacity-40" : ""}`}
              onMouseEnter={() => onActivityHover?.(activity.id)}
              onMouseLeave={() => onActivityHover?.(null)}
            >
              <ActivityCard
                activity={activity}
                onEdit={handleEditActivity}
                onDelete={handleDeleteActivity}
                isDeleting={deletingId === activity.id}
                travelEndpointOptions={travelEndpointRows}
                tripAccommodations={tripAccommodations}
                restAccommodationChoices={accommodationOptions}
                scheduleDate={dayPlan.date}
                alternativeOptions={altOptionsForActivity(activity)}
                onRemoveAlternative={handleRemoveAlternative}
                onAddAlternative={handleAddAlternative}
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
                onChange={(e) => { setAddType(e.target.value); setAddAlternatives([]); setAddRestAccommodationIdx("") }}
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

            {/* Accommodation option for meal at lodging */}
            {addType === "meal" && accommodationOptions.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">לינה (אם הארוחה בלינה)</label>
                <select
                  value={addRestAccommodationIdx}
                  onChange={(e) => setAddRestAccommodationIdx(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">ללא (מסעדה / מקום אחר)</option>
                  {accommodationOptions.map((opt) => (
                    <option key={opt.index} value={String(opt.index)}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Grocery store dropdown */}
            {addType === "grocery" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">{"חנות מכולת"}</label>
                <select
                  value={addGroceryStoreId}
                  onChange={(e) => setAddGroceryStoreId(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">{"בחרו חנות..."}</option>
                  {filteredGroceryStores.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Alternatives section (only for supported types) */}
            {supportsAlternatives(addType) && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-500">חלופות</label>
                  <button
                    type="button"
                    onClick={addAltRow}
                    className="text-[11px] text-violet-600 hover:text-violet-700 dark:text-violet-400"
                  >
                    + הוסף {alternativePlanLabel(addAlternatives.length)}
                  </button>
                </div>

                {addAlternatives.map((alt, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 rounded border border-violet-200 bg-violet-50 p-2 dark:border-violet-700 dark:bg-violet-900/20"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-violet-500 dark:text-violet-400">
                        {alternativePlanLabel(i)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAltRow(i)}
                        className="text-[11px] text-zinc-400 hover:text-red-500"
                      >
                        הסר
                      </button>
                    </div>

                    {addType === "attraction" && (
                      <select
                        value={alt.attractionId}
                        onChange={(e) => updateAltRow(i, "attractionId", e.target.value)}
                        className="rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-700"
                      >
                        <option value="">בחרו אטרקציה...</option>
                        {filteredAttractions.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    )}
                    {addType === "meal" && (
                      <select
                        value={alt.restaurantId}
                        onChange={(e) => updateAltRow(i, "restaurantId", e.target.value)}
                        className="rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-700"
                      >
                        <option value="">בחרו מסעדה...</option>
                        {filteredRestaurants.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    )}
                    {addType === "grocery" && (
                      <select
                        value={alt.groceryStoreId}
                        onChange={(e) => updateAltRow(i, "groceryStoreId", e.target.value)}
                        className="rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-700"
                      >
                        <option value="">בחרו חנות...</option>
                        {filteredGroceryStores.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    )}

                    <input
                      type="text"
                      value={alt.notes}
                      onChange={(e) => updateAltRow(i, "notes", e.target.value)}
                      placeholder="הערות לחלופה (אופציונלי)..."
                      className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-700"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Driving: origin / destination */}
            {addType === "travel" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-500">נקודת מוצא</label>
                  <select
                    value={addTravelOrigin}
                    onChange={(e) => setAddTravelOrigin(e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                  >
                    <option value="">בחרו...</option>
                    {travelEndpointRows.map((row) => (
                      <option key={`o-${row.value}`} value={row.value}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-500">יעד</label>
                  <select
                    value={addTravelDest}
                    onChange={(e) => setAddTravelDest(e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                  >
                    <option value="">בחרו...</option>
                    {travelEndpointRows.map((row) => (
                      <option key={`d-${row.value}`} value={row.value}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </div>
                {travelEndpointRows.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    אין עדיין מקומות שמורים (אטרקציות/מסעדות/מכולת/לינה/טיסות/רכב) — הוסיפו אותם בטאבים הרלוונטיים או בסקירה.
                  </p>
                )}
              </>
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

            {addType === "rest" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">לינה</label>
                <select
                  value={addRestAccommodationIdx}
                  onChange={(e) => setAddRestAccommodationIdx(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">בחרו לינה...</option>
                  {accommodationOptions.map((opt) => (
                    <option key={opt.index} value={String(opt.index)}>
                      {opt.name}
                    </option>
                  ))}
                </select>
                {accommodationOptions.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    הוסיפו לינה בסקירת הטיול כדי לשייך מנוחה למקום.
                  </p>
                )}
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
                className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isSubmitting && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                  </svg>
                )}
                {isSubmitting ? "שומר..." : "הוסף"}
              </button>
              <button
                onClick={resetAddForm}
                disabled={isSubmitting}
                className="rounded border border-zinc-300 px-4 py-1.5 text-xs hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-700"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
