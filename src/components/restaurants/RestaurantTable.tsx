"use client"

import { useState } from "react"

interface SavedRestaurant {
  id: string
  googlePlaceId: string | null
  name: string
  cuisineType: string | null
  address: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  website: string | null
  openingHours: unknown
  ratingGoogle: number | null
  travelTimeMinutes: number | null
  kidFriendly: boolean
  status: string
}

interface RestaurantTableProps {
  tripId: string
  restaurants: SavedRestaurant[]
  onUpdate: () => void
}

type StatusFilter = "all" | "want" | "maybe"
type SortField = "name" | "travelTime" | "rating"

const statusLabels: Record<string, string> = {
  want: "רוצה",
  maybe: "אולי",
  rejected: "לא מתאים",
}

const statusColors: Record<string, string> = {
  want: "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400",
  maybe: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  rejected: "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400",
}

export function RestaurantTable({
  tripId,
  restaurants,
  onUpdate,
}: RestaurantTableProps) {
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filtered = restaurants.filter((r) => {
    if (filter === "all") return r.status !== "rejected"
    return r.status === filter
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === "name") return a.name.localeCompare(b.name)
    if (sortField === "travelTime") {
      return (a.travelTimeMinutes ?? 999) - (b.travelTimeMinutes ?? 999)
    }
    if (sortField === "rating") {
      return (b.ratingGoogle ?? 0) - (a.ratingGoogle ?? 0)
    }
    return 0
  })

  async function handleStatusChange(id: string, status: string) {
    setUpdatingId(id)
    try {
      await fetch(`/api/trips/${tripId}/restaurants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      onUpdate()
    } catch (error) {
      console.error("Status update failed:", error)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleKidFriendlyToggle(id: string, current: boolean) {
    setUpdatingId(id)
    try {
      await fetch(`/api/trips/${tripId}/restaurants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidFriendly: !current }),
      })
      onUpdate()
    } catch (error) {
      console.error("Kid friendly toggle failed:", error)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(id: string) {
    setUpdatingId(id)
    try {
      await fetch(`/api/trips/${tripId}/restaurants/${id}`, {
        method: "DELETE",
      })
      onUpdate()
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setUpdatingId(null)
    }
  }

  function formatOpeningHours(hours: unknown): string | null {
    if (!hours) return null
    if (typeof hours === "object" && hours !== null && "weekdayDescriptions" in hours) {
      const descs = (hours as { weekdayDescriptions?: string[] }).weekdayDescriptions
      return descs?.join(", ") ?? null
    }
    return null
  }

  if (restaurants.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/50">
        <span className="text-sm text-zinc-400">
          עדיין לא נשמרו מסעדות. עבור ללשונית &quot;גלה מסעדות&quot; כדי לחפש.
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters and sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
          {(["all", "want", "maybe"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
              }`}
            >
              {f === "all" ? "הכל" : statusLabels[f]}
            </button>
          ))}
        </div>

        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
          dir="rtl"
        >
          <option value="name">מיון: שם</option>
          <option value="travelTime">מיון: זמן נסיעה</option>
          <option value="rating">מיון: דירוג</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm" dir="rtl">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">שם</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">סוג אוכל</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">כתובת</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">זמן נסיעה</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">דירוג</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">מתאים לילדים</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">סטטוס</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
            {sorted.map((restaurant) => (
              <>
                <tr
                  key={restaurant.id}
                  className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-750"
                  onClick={() =>
                    setExpandedId(
                      expandedId === restaurant.id ? null : restaurant.id
                    )
                  }
                >
                  <td className="px-3 py-2 font-medium">{restaurant.name}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {restaurant.cuisineType ? (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
                        {restaurant.cuisineType}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-40 truncate px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {restaurant.address ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {restaurant.travelTimeMinutes
                      ? `${restaurant.travelTimeMinutes} דק׳`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {restaurant.ratingGoogle
                      ? `${restaurant.ratingGoogle} ★`
                      : "—"}
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() =>
                        handleKidFriendlyToggle(restaurant.id, restaurant.kidFriendly)
                      }
                      disabled={updatingId === restaurant.id}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                        restaurant.kidFriendly
                          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      {restaurant.kidFriendly ? "כן" : "לא"}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusColors[restaurant.status] ?? statusColors.maybe
                      }`}
                    >
                      {statusLabels[restaurant.status] ?? restaurant.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {restaurant.googlePlaceId && (
                        <a
                          href={`https://www.google.com/maps/place/?q=place_id:${restaurant.googlePlaceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        >
                          מפה
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(restaurant.id)}
                        disabled={updatingId === restaurant.id}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === restaurant.id && (
                  <tr key={`${restaurant.id}-expanded`}>
                    <td colSpan={8} className="bg-zinc-50 px-4 py-3 dark:bg-zinc-900/50">
                      <div className="flex flex-col gap-2 text-sm">
                        {restaurant.phone && (
                          <div>
                            <span className="font-medium text-zinc-600 dark:text-zinc-400">טלפון: </span>
                            <span dir="ltr">{restaurant.phone}</span>
                          </div>
                        )}
                        {restaurant.website && (
                          <div>
                            <span className="font-medium text-zinc-600 dark:text-zinc-400">אתר: </span>
                            <a
                              href={restaurant.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {restaurant.website}
                            </a>
                          </div>
                        )}
                        {formatOpeningHours(restaurant.openingHours) && (
                          <div>
                            <span className="font-medium text-zinc-600 dark:text-zinc-400">שעות פתיחה: </span>
                            <span>{formatOpeningHours(restaurant.openingHours)}</span>
                          </div>
                        )}
                        {/* Status change buttons */}
                        <div className="flex gap-2 pt-2">
                          {restaurant.status !== "want" && (
                            <button
                              onClick={() => handleStatusChange(restaurant.id, "want")}
                              disabled={updatingId === restaurant.id}
                              className="rounded-lg bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400"
                            >
                              רוצה
                            </button>
                          )}
                          {restaurant.status !== "maybe" && (
                            <button
                              onClick={() => handleStatusChange(restaurant.id, "maybe")}
                              disabled={updatingId === restaurant.id}
                              className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400"
                            >
                              אולי
                            </button>
                          )}
                          {restaurant.status !== "rejected" && (
                            <button
                              onClick={() => handleStatusChange(restaurant.id, "rejected")}
                              disabled={updatingId === restaurant.id}
                              className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400"
                            >
                              לא מתאים
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
