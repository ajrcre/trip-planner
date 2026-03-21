"use client"

import { useState } from "react"
import { RestaurantCard } from "./RestaurantCard"

interface DiscoveredRestaurant {
  googlePlaceId: string
  name: string
  description: string | null
  address: string | null
  lat: number | null
  lng: number | null
  rating: number | null
  userRatingCount: number | null
  photos: string[]
  types: string[]
  cuisineType: string | null
}

interface DiscoveryPanelProps {
  tripId: string
  savedPlaceIds: Set<string>
  onRestaurantSaved: () => void
}

const quickFilters = [
  { label: "איטלקי", query: "italian restaurant" },
  { label: "יווני", query: "greek restaurant" },
  { label: "אסייתי", query: "asian restaurant" },
  { label: "דגים/פירות ים", query: "seafood restaurant" },
  { label: "בשרים", query: "steak house" },
  { label: "משפחתי", query: "family restaurant" },
  { label: "בית קפה", query: "cafe" },
]

export function DiscoveryPanel({
  tripId,
  savedPlaceIds,
  onRestaurantSaved,
}: DiscoveryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<DiscoveredRestaurant[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [localSavedIds, setLocalSavedIds] = useState<Set<string>>(new Set())

  const allSavedIds = new Set([...savedPlaceIds, ...localSavedIds])

  async function handleSearch(query?: string) {
    const q = query ?? searchQuery
    setLoading(true)
    setSearched(true)

    try {
      const response = await fetch(
        `/api/trips/${tripId}/restaurants/discover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q || undefined }),
        }
      )

      if (!response.ok) throw new Error("Search failed")

      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error("Search error:", error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(
    restaurant: DiscoveredRestaurant,
    status: string
  ) {
    if (savingIds.has(restaurant.googlePlaceId)) return

    setSavingIds((prev) => new Set([...prev, restaurant.googlePlaceId]))

    try {
      const response = await fetch(`/api/trips/${tripId}/restaurants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googlePlaceId: restaurant.googlePlaceId,
          name: restaurant.name,
          address: restaurant.address,
          lat: restaurant.lat,
          lng: restaurant.lng,
          ratingGoogle: restaurant.rating,
          photos: restaurant.photos,
          cuisineType: restaurant.cuisineType,
          types: restaurant.types,
          status,
        }),
      })

      if (!response.ok) throw new Error("Save failed")

      setLocalSavedIds((prev) =>
        new Set([...prev, restaurant.googlePlaceId])
      )
      onRestaurantSaved()
    } catch (error) {
      console.error("Save error:", error)
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(restaurant.googlePlaceId)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch()
          }}
          placeholder="חפש מסעדות"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
          dir="rtl"
        />
        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "חפש"}
        </button>
      </div>

      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-2">
        {quickFilters.map((filter) => (
          <button
            key={filter.query}
            onClick={() => {
              setSearchQuery(filter.query)
              handleSearch(filter.query)
            }}
            disabled={loading}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* Results grid */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((restaurant) => (
            <RestaurantCard
              key={restaurant.googlePlaceId}
              restaurant={restaurant}
              savedIds={allSavedIds}
              onSave={handleSave}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && results.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
          <span className="text-sm text-zinc-400">
            לא נמצאו תוצאות. נסה חיפוש אחר.
          </span>
        </div>
      )}

      {/* Initial state */}
      {!loading && !searched && (
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/50">
          <span className="text-sm text-zinc-400">
            חפש מסעדות או בחר קטגוריה למעלה
          </span>
        </div>
      )}
    </div>
  )
}
