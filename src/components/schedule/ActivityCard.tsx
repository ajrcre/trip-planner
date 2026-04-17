"use client"

import { useState, useMemo } from "react"
import type { Accommodation } from "@/lib/accommodations"
import { googleMapsUrl } from "@/lib/url-helpers"
import { detectTimeConflict } from "@/lib/time-parsing"
import type { TravelEndpointRef, TravelLegStored } from "@/types/travel-leg"
import { decodeTravelEndpoint, encodeTravelEndpoint } from "@/lib/travel-endpoint-codec"
import { OpeningHoursSection } from "./OpeningHoursSection"
import { alternativePlanLabel, supportsAlternatives } from "@/lib/activity-alternatives"

export interface PlaceData {
  id: string
  name: string
  address: string | null
  phone: string | null
  website: string | null
  googlePlaceId: string | null
  openingHours: unknown
  lat: number | null
  lng: number | null
}

export interface ActivityAlternativeData {
  id: string
  priority: number
  notes: string | null
  attractionId: string | null
  restaurantId: string | null
  groceryStoreId: string | null
  attraction: PlaceData | null
  restaurant: PlaceData | null
  groceryStore: PlaceData | null
  drivingTimesFromLodging?: { accommodationName: string; minutes: number }[]
}

export interface ActivityData {
  id: string
  sortOrder: number
  timeStart: string | null
  timeEnd: string | null
  type: string
  notes: string | null
  attractionId: string | null
  restaurantId: string | null
  groceryStoreId: string | null
  restAccommodationIndex?: number | null
  travelTimeToNextMinutes: number | null
  attraction: PlaceData | null
  restaurant: PlaceData | null
  groceryStore: PlaceData | null
  drivingTimesFromLodging?: { accommodationName: string; minutes: number }[]
  travelLeg?: TravelLegStored | null
  alternatives?: ActivityAlternativeData[]
}

const typeConfig: Record<string, { icon: string; label: string }> = {
  attraction: { icon: "\u{1F3DB}\uFE0F", label: "אטרקציה" },
  meal: { icon: "\u{1F37D}\uFE0F", label: "ארוחה" },
  travel: { icon: "\u{1F697}", label: "נסיעה" },
  rest: { icon: "\u{1F634}", label: "מנוחה" },
  custom: { icon: "\u{1F4DD}", label: "אחר" },
  grocery: { icon: "🛒", label: "קניות" },
  flight_departure: { icon: "✈️", label: "המראה" },
  flight_arrival: { icon: "🛬", label: "נחיתה" },
  car_pickup: { icon: "📋", label: "איסוף רכב" },
  car_return: { icon: "📋", label: "החזרת רכב" },
  lodging: { icon: "🏨", label: "לינה" },
}

/** Infer meal label from start time */
function getMealLabel(timeStart: string | null): string {
  if (!timeStart) return "ארוחה"
  const hour = parseInt(timeStart.split(":")[0], 10)
  if (isNaN(hour)) return "ארוחה"
  if (hour < 11) return "ארוחת בוקר"
  if (hour < 16) return "ארוחת צהריים"
  return "ארוחת ערב"
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function hrefForUserWebsite(raw: string): string {
  const t = raw.trim()
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

interface ActivityCardProps {
  activity: ActivityData
  onEdit: (
    activity: ActivityData,
    updates: {
      timeStart?: string
      timeEnd?: string
      notes?: string
      travelLeg?: { origin: TravelEndpointRef; destination: TravelEndpointRef } | null
      restAccommodationIndex?: number | null
    }
  ) => void | Promise<void>
  onDelete: (activityId: string) => void
  isDeleting?: boolean
  /** Options for editing driving activity origin/destination (same list as add form) */
  travelEndpointOptions?: { value: string; label: string }[]
  /** Full trip accommodations (indices match `restAccommodationIndex` and travel lodging refs) */
  tripAccommodations?: Accommodation[]
  /** Labels for rest activity accommodation picker (same indices as trip accommodations) */
  restAccommodationChoices?: { index: number; name: string }[]
  /** The date of the schedule day (YYYY-MM-DD) for context-aware display (e.g. opening hours) */
  scheduleDate?: string
  /** Available places for adding alternatives (same type as primary) */
  alternativeOptions?: { id: string; name: string }[]
  onRemoveAlternative?: (activityId: string, alternativeId: string) => Promise<void>
  onAddAlternative?: (activityId: string, placeId: string, notes: string) => Promise<void>
}

export function ActivityCard({
  activity,
  onEdit,
  onDelete,
  isDeleting,
  travelEndpointOptions = [],
  tripAccommodations,
  restAccommodationChoices,
  scheduleDate,
  alternativeOptions = [],
  onRemoveAlternative,
  onAddAlternative,
}: ActivityCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [editTimeStart, setEditTimeStart] = useState(activity.timeStart ?? "")
  const [editTimeEnd, setEditTimeEnd] = useState(activity.timeEnd ?? "")
  const [editNotes, setEditNotes] = useState(activity.notes ?? "")
  const [editTravelOrigin, setEditTravelOrigin] = useState("")
  const [editTravelDest, setEditTravelDest] = useState("")
  const [editRestAccommodationIdx, setEditRestAccommodationIdx] = useState("")

  // Alternatives UI state
  const [showAlternatives, setShowAlternatives] = useState(true)
  const [openAltDetails, setOpenAltDetails] = useState<Set<string>>(new Set())
  const [showAddAlt, setShowAddAlt] = useState(false)
  const [addAltPlaceId, setAddAltPlaceId] = useState("")
  const [addAltNotes, setAddAltNotes] = useState("")
  const [isAddingAlt, setIsAddingAlt] = useState(false)
  const [removingAltId, setRemovingAltId] = useState<string | null>(null)

  function toggleAltDetails(altId: string) {
    setOpenAltDetails((prev) => {
      const next = new Set(prev)
      if (next.has(altId)) next.delete(altId)
      else next.add(altId)
      return next
    })
  }

  const config = typeConfig[activity.type] ?? typeConfig.custom

  const place = activity.attraction ?? activity.restaurant ?? activity.groceryStore
  const restAccommodation =
    activity.type === "rest" &&
    activity.restAccommodationIndex != null &&
    tripAccommodations
      ? tripAccommodations[activity.restAccommodationIndex]
      : undefined
  const hasDetails = !!(place && (place.address || place.phone || place.website || place.openingHours || place.googlePlaceId))

  const timeConflict = useMemo(() => {
    if (!place?.openingHours) return null
    return detectTimeConflict(activity.timeStart, activity.timeEnd, place.openingHours, scheduleDate)
  }, [activity.timeStart, activity.timeEnd, place?.openingHours, scheduleDate])

  const name = (() => {
    if (
      activity.type === "travel" &&
      activity.travelLeg?.resolvedOrigin &&
      activity.travelLeg?.resolvedDestination
    ) {
      return `${activity.travelLeg.resolvedOrigin.label} → ${activity.travelLeg.resolvedDestination.label}`
    }
    if (activity.type === "rest" && restAccommodation?.name) {
      return `מנוחה — ${restAccommodation.name}`
    }
    return (
      activity.attraction?.name ??
      activity.restaurant?.name ??
      activity.groceryStore?.name ??
      activity.notes ??
      config.label
    )
  })()

  const alternatives = activity.alternatives ?? []
  const canHaveAlternatives = supportsAlternatives(activity.type)

  async function handleSave() {
    if (isSaving) return
    setIsSaving(true)
    try {
      if (activity.type === "travel") {
        const o = decodeTravelEndpoint(editTravelOrigin)
        const d = decodeTravelEndpoint(editTravelDest)
        if (!o || !d) {
          window.alert("בחרו נקודת מוצא ויעד לנסיעה")
          return
        }
        if (encodeTravelEndpoint(o) === encodeTravelEndpoint(d)) {
          window.alert("מקור ויעד חייבים להיות שונים")
          return
        }
        await onEdit(activity, {
          timeStart: editTimeStart || undefined,
          timeEnd: editTimeEnd || undefined,
          notes: editNotes || undefined,
          travelLeg: { origin: o, destination: d },
        })
      } else if (activity.type === "rest") {
        if (editRestAccommodationIdx === "") {
          window.alert("בחרו לינה למנוחה")
          return
        }
        const idx = parseInt(editRestAccommodationIdx, 10)
        if (Number.isNaN(idx)) {
          window.alert("בחרו לינה תקינה")
          return
        }
        await onEdit(activity, {
          timeStart: editTimeStart || undefined,
          timeEnd: editTimeEnd || undefined,
          notes: editNotes || undefined,
          restAccommodationIndex: idx,
        })
      } else {
        await onEdit(activity, {
          timeStart: editTimeStart || undefined,
          timeEnd: editTimeEnd || undefined,
          notes: editNotes || undefined,
        })
      }
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  function handleCancel() {
    setEditTimeStart(activity.timeStart ?? "")
    setEditTimeEnd(activity.timeEnd ?? "")
    setEditNotes(activity.notes ?? "")
    if (activity.travelLeg?.origin && activity.travelLeg?.destination) {
      setEditTravelOrigin(encodeTravelEndpoint(activity.travelLeg.origin))
      setEditTravelDest(encodeTravelEndpoint(activity.travelLeg.destination))
    } else {
      setEditTravelOrigin("")
      setEditTravelDest("")
    }
    setEditRestAccommodationIdx(
      activity.restAccommodationIndex != null
        ? String(activity.restAccommodationIndex)
        : ""
    )
    setIsEditing(false)
  }

  function beginEditing() {
    setEditTimeStart(activity.timeStart ?? "")
    setEditTimeEnd(activity.timeEnd ?? "")
    setEditNotes(activity.notes ?? "")
    if (activity.type === "travel" && activity.travelLeg?.origin && activity.travelLeg?.destination) {
      setEditTravelOrigin(encodeTravelEndpoint(activity.travelLeg.origin))
      setEditTravelDest(encodeTravelEndpoint(activity.travelLeg.destination))
    } else {
      setEditTravelOrigin("")
      setEditTravelDest("")
    }
    setEditRestAccommodationIdx(
      activity.restAccommodationIndex != null
        ? String(activity.restAccommodationIndex)
        : ""
    )
    setIsEditing(true)
  }

  async function handleRemoveAlt(altId: string) {
    if (!onRemoveAlternative) return
    setRemovingAltId(altId)
    try {
      await onRemoveAlternative(activity.id, altId)
    } finally {
      setRemovingAltId(null)
    }
  }

  async function handleAddAlt() {
    if (!onAddAlternative || !addAltPlaceId) return
    setIsAddingAlt(true)
    try {
      await onAddAlternative(activity.id, addAltPlaceId, addAltNotes)
      setAddAltPlaceId("")
      setAddAltNotes("")
      setShowAddAlt(false)
    } finally {
      setIsAddingAlt(false)
    }
  }

  const nextAltLabel = alternativePlanLabel(alternatives.length)

  return (
    <div className="group relative rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800">

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

          {activity.type === "rest" &&
            restAccommodationChoices &&
            restAccommodationChoices.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">לינה</label>
                <select
                  value={editRestAccommodationIdx}
                  onChange={(e) => setEditRestAccommodationIdx(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">בחרו לינה...</option>
                  {restAccommodationChoices.map((opt) => (
                    <option key={opt.index} value={String(opt.index)}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

          {activity.type === "travel" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">נקודת מוצא</label>
                <select
                  value={editTravelOrigin}
                  onChange={(e) => setEditTravelOrigin(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">בחרו...</option>
                  {travelEndpointOptions.map((row) => (
                    <option key={`eo-${row.value}`} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500">יעד</label>
                <select
                  value={editTravelDest}
                  onChange={(e) => setEditTravelDest(e.target.value)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
                >
                  <option value="">בחרו...</option>
                  {travelEndpointOptions.map((row) => (
                    <option key={`ed-${row.value}`} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </div>
              {travelEndpointOptions.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  אין מקומות זמינים לבחירה — הוסיפו אטרקציות, מסעדות, לינה או פרטי טיסה/רכב בטיול.
                </p>
              )}
            </>
          )}

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

          {/* Alternatives management — only in edit mode */}
          {canHaveAlternatives && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-violet-600 dark:text-violet-400">חלופות</span>
              {alternatives.length > 0 && (
                <div className="flex flex-col gap-1 border-r-2 border-violet-200 pr-2 dark:border-violet-700">
                  {alternatives.map((alt) => {
                    const altPlace = alt.attraction ?? alt.restaurant ?? alt.groceryStore
                    if (!altPlace) return null
                    const isRemoving = removingAltId === alt.id
                    return (
                      <div
                        key={alt.id}
                        className="flex items-center justify-between gap-2 rounded bg-violet-50 px-2 py-1.5 dark:bg-violet-900/20"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold text-violet-500 dark:text-violet-400">
                            {alternativePlanLabel(alt.priority)}
                          </span>
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                            {altPlace.name}
                          </span>
                          {alt.notes && (
                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{alt.notes}</span>
                          )}
                        </div>
                        {onRemoveAlternative && (
                          <button
                            onClick={() => handleRemoveAlt(alt.id)}
                            disabled={isRemoving}
                            className="shrink-0 rounded p-0.5 text-zinc-300 hover:bg-red-50 hover:text-red-400 disabled:opacity-50 dark:hover:bg-red-900/20"
                            title="הסר חלופה"
                          >
                            {isRemoving ? (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                              </svg>
                            ) : (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add alternative form */}
              {onAddAlternative && !showAddAlt && (
                <button
                  onClick={() => setShowAddAlt(true)}
                  className="flex items-center gap-1 text-[11px] text-violet-500 hover:text-violet-700 dark:text-violet-400"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  הוסף {nextAltLabel}
                </button>
              )}

              {onAddAlternative && showAddAlt && (
                <div className="flex flex-col gap-2 rounded border border-violet-200 bg-violet-50 p-2 dark:border-violet-700 dark:bg-violet-900/20">
                  <span className="text-[10px] font-semibold text-violet-500 dark:text-violet-400">
                    {nextAltLabel}
                  </span>
                  <select
                    value={addAltPlaceId}
                    onChange={(e) => setAddAltPlaceId(e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-600 dark:bg-zinc-700"
                  >
                    <option value="">בחרו...</option>
                    {alternativeOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={addAltNotes}
                    onChange={(e) => setAddAltNotes(e.target.value)}
                    placeholder="הערות (אופציונלי)..."
                    className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-700"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAddAlt}
                      disabled={isAddingAlt || !addAltPlaceId}
                      className="inline-flex items-center gap-1 rounded bg-violet-600 px-2.5 py-1 text-[11px] text-white hover:bg-violet-700 disabled:opacity-60"
                    >
                      {isAddingAlt && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                          <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                        </svg>
                      )}
                      {isAddingAlt ? "שומר..." : "הוסף"}
                    </button>
                    <button
                      onClick={() => { setShowAddAlt(false); setAddAltPlaceId(""); setAddAltNotes("") }}
                      disabled={isAddingAlt}
                      className="rounded border border-zinc-300 px-2.5 py-1 text-[11px] hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-700"
                    >
                      ביטול
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
              )}
              {isSaving ? "שומר..." : "שמור"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-700"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg">{config.icon}</span>

          <div className="flex flex-1 flex-col gap-1">
            {(activity.timeStart || activity.timeEnd) && (
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                {activity.timeStart ?? ""}
                {activity.timeStart && activity.timeEnd ? " - " : ""}
                {activity.timeEnd ?? ""}
              </span>
            )}

            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {activity.type === "meal" ? getMealLabel(activity.timeStart) : config.label}
            </span>

            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{name}</span>
            </div>

            {activity.type === "rest" && restAccommodation && (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={googleMapsUrl(restAccommodation.name ?? "לינה", {
                    lat: restAccommodation.coordinates?.lat ?? null,
                    lng: restAccommodation.coordinates?.lng ?? null,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  🗺️ מפה
                </a>
                {restAccommodation.website ? (
                  <a
                    href={hrefForUserWebsite(restAccommodation.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    🌐 {getHostname(hrefForUserWebsite(restAccommodation.website))}
                  </a>
                ) : null}
              </div>
            )}

            {activity.type === "travel" && activity.travelLeg?.driveMinutes != null && (
              <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
                {"\u{1F697}"} {activity.travelLeg.driveMinutes} דק׳ נסיעה משוערות
              </span>
            )}

            {activity.type === "travel" && activity.travelLeg?.resolvedOrigin && activity.travelLeg?.resolvedDestination && (() => {
              const orig = activity.travelLeg!.resolvedOrigin!
              const dest = activity.travelLeg!.resolvedDestination!
              const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${orig.lat},${orig.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`
              const wazeUrl = `https://waze.com/ul?ll=${dest.lat},${dest.lng}&from=ll.${orig.lat},${orig.lng}&navigate=yes`
              return (
                <div className="flex items-center gap-3">
                  <a
                    href={gmapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <span>🗺️</span> Google Maps
                  </a>
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <span>📍</span> Waze
                  </a>
                </div>
              )
            })()}

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

            {activity.notes &&
              activity.type !== "custom" &&
              activity.type !== "travel" && (
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

                    {/* Opening hours */}
                    {!!place.openingHours && (
                      <OpeningHoursSection openingHours={place.openingHours} scheduleDate={scheduleDate} />
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
                  </div>
                )}
              </div>
            )}

            {/* Backup alternatives (Plan B, C, D...) — view only, no add/remove controls */}
            {canHaveAlternatives && alternatives.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowAlternatives(!showAlternatives)}
                  className="flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-700 dark:text-violet-400"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transition-transform ${showAlternatives ? "rotate-90" : "rotate-0"}`}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  {showAlternatives
                    ? `הסתר חלופות (${alternatives.length})`
                    : `הצג חלופות (${alternatives.length})`}
                </button>

                {showAlternatives && (
                  <div className="mt-1.5 flex flex-col gap-2 border-r-2 border-violet-200 pr-2 dark:border-violet-700">
                    {alternatives.map((alt) => {
                      const altPlace = alt.attraction ?? alt.restaurant ?? alt.groceryStore
                      if (!altPlace) return null
                      const altDetailsOpen = openAltDetails.has(alt.id)
                      const altHasDetails = !!(altPlace.address || altPlace.phone || altPlace.website || altPlace.openingHours || altPlace.googlePlaceId)
                      return (
                        <div
                          key={alt.id}
                          className="rounded bg-violet-50 px-2 py-1.5 dark:bg-violet-900/20"
                        >
                          <span className="text-[10px] font-semibold text-violet-500 dark:text-violet-400">
                            {alternativePlanLabel(alt.priority)}
                          </span>
                          <div className="mt-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                            {altPlace.name}
                          </div>
                          {alt.notes && (
                            <div className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{alt.notes}</div>
                          )}
                          {alt.drivingTimesFromLodging && alt.drivingTimesFromLodging.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {alt.drivingTimesFromLodging.map((dt, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                  title={`נסיעה מ${dt.accommodationName}`}
                                >
                                  🏨→🚗 {dt.minutes} דק׳
                                  {alt.drivingTimesFromLodging!.length > 1 && (
                                    <span className="text-blue-400 dark:text-blue-500">
                                      ({dt.accommodationName})
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                          {altHasDetails && (
                            <div className="mt-1">
                              <button
                                onClick={() => toggleAltDetails(alt.id)}
                                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className={`transition-transform ${altDetailsOpen ? "rotate-90" : "rotate-0"}`}
                                >
                                  <path d="M9 18l6-6-6-6" />
                                </svg>
                                {altDetailsOpen ? "הסתר פרטים" : "הצג פרטים"}
                              </button>

                              {altDetailsOpen && (
                                <div className="mt-1 flex flex-col gap-1.5 rounded-md bg-zinc-50 p-2 dark:bg-zinc-700/50">
                                  {!!altPlace.openingHours && (
                                    <OpeningHoursSection openingHours={altPlace.openingHours} scheduleDate={scheduleDate} />
                                  )}
                                  {!!altPlace.address && (
                                    <div className="flex items-start gap-1.5">
                                      <span className="text-xs">📍</span>
                                      <span className="text-xs text-zinc-600 dark:text-zinc-300">{altPlace.address}</span>
                                    </div>
                                  )}
                                  {!!altPlace.phone && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs">📞</span>
                                      <a
                                        href={`tel:${altPlace.phone}`}
                                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                      >
                                        {altPlace.phone}
                                      </a>
                                    </div>
                                  )}
                                  {!!altPlace.website && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs">🌐</span>
                                      <a
                                        href={hrefForUserWebsite(altPlace.website)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                      >
                                        {getHostname(hrefForUserWebsite(altPlace.website))}
                                      </a>
                                    </div>
                                  )}
                                  {!!altPlace.googlePlaceId && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs">🗺️</span>
                                      <a
                                        href={`https://www.google.com/maps/place/?q=place_id:${altPlace.googlePlaceId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                                      >
                                        הצג בגוגל מפות
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <button
              onClick={beginEditing}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
              title={"\u05E2\u05E8\u05D9\u05DB\u05D4"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => {
                if (!confirm("למחוק את הפעילות?")) return
                onDelete(activity.id)
              }}
              disabled={isDeleting}
              className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-900/20"
              title={"\u05DE\u05D7\u05D9\u05E7\u05D4"}
            >
              {isDeleting ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              )}
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
