"use client"

import { useState } from "react"
import { AttractionCard } from "./AttractionCard"

interface DiscoveredAttraction {
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
}

interface DiscoveryPanelProps {
  tripId: string
  savedPlaceIds: Set<string>
  onAttractionSaved: () => void
}

const quickFilters = [
  { label: "טבע", query: "nature" },
  { label: "מוזיאונים", query: "museums" },
  { label: "פארקים", query: "parks" },
  { label: "חופים", query: "beaches" },
  { label: "היסטורי", query: "historical sites" },
  { label: "משפחות", query: "family friendly activities" },
]

export function DiscoveryPanel({
  tripId,
  savedPlaceIds,
  onAttractionSaved,
}: DiscoveryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<DiscoveredAttraction[]>([])
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
        `/api/trips/${tripId}/attractions/discover`,
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
    attraction: DiscoveredAttraction,
    status: string
  ) {
    if (savingIds.has(attraction.googlePlaceId)) return

    setSavingIds((prev) => new Set([...prev, attraction.googlePlaceId]))

    try {
      const response = await fetch(`/api/trips/${tripId}/attractions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googlePlaceId: attraction.googlePlaceId,
          name: attraction.name,
          description: attraction.description,
          address: attraction.address,
          lat: attraction.lat,
          lng: attraction.lng,
          ratingGoogle: attraction.rating,
          photos: attraction.photos,
          status,
        }),
      })

      if (!response.ok) throw new Error("Save failed")

      setLocalSavedIds((prev) =>
        new Set([...prev, attraction.googlePlaceId])
      )
      onAttractionSaved()
    } catch (error) {
      console.error("Save error:", error)
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(attraction.googlePlaceId)
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
          placeholder="חפש אטרקציות"
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
          {results.map((attraction) => (
            <AttractionCard
              key={attraction.googlePlaceId}
              attraction={attraction}
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
            חפש אטרקציות או בחר קטגוריה למעלה
          </span>
        </div>
      )}
    </div>
  )
}
