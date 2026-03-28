"use client"

import { useState } from "react"

interface DiscoveryItem {
  googlePlaceId: string
  name: string
  rating: number | null
  travelTimeMinutes?: number | null
}

export interface DiscoveryConfig<T extends DiscoveryItem> {
  discoverEndpoint: string
  saveEndpoint: string
  quickFilters: { label: string; query: string }[]
  CardComponent: React.ComponentType<{
    item: T
    savedIds: Set<string>
    onSave: (item: T, status: string) => void
  }>
  buildSavePayload: (item: T, status: string) => Record<string, unknown>
  onItemSaved: () => void
  searchPlaceholder: string
  emptyStateText: string
}

interface Accommodation {
  name?: string
  address?: string
  coordinates?: { lat: number; lng: number }
}

interface DiscoveryPanelProps<T extends DiscoveryItem> {
  tripId: string
  savedPlaceIds: Set<string>
  config: DiscoveryConfig<T>
  accommodations?: Accommodation[]
}

export function DiscoveryPanel<T extends DiscoveryItem>({
  tripId,
  savedPlaceIds,
  config,
  accommodations,
}: DiscoveryPanelProps<T>) {
  const {
    discoverEndpoint,
    saveEndpoint,
    quickFilters,
    CardComponent,
    buildSavePayload,
    onItemSaved,
    searchPlaceholder,
    emptyStateText,
  } = config

  const [searchQuery, setSearchQuery] = useState("")
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [sortField, setSortField] = useState<"travelTime" | "rating" | "name">("travelTime")
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [localSavedIds, setLocalSavedIds] = useState<Set<string>>(new Set())
  const [selectedAccommodationIdx, setSelectedAccommodationIdx] = useState(0)

  const allSavedIds = new Set([...savedPlaceIds, ...localSavedIds])

  async function handleSearch(query?: string) {
    const q = query ?? searchQuery
    setLoading(true)
    setSearched(true)

    try {
      const response = await fetch(
        `/api/trips/${tripId}/${discoverEndpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q || undefined,
            ...(accommodations && accommodations.length > 1
              ? { accommodationId: `${selectedAccommodationIdx}` }
              : {}),
          }),
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

  async function handleSave(item: T, status: string) {
    if (savingIds.has(item.googlePlaceId)) return

    setSavingIds((prev) => new Set([...prev, item.googlePlaceId]))

    try {
      const response = await fetch(`/api/trips/${tripId}/${saveEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload(item, status)),
      })

      if (!response.ok) throw new Error("Save failed")

      setLocalSavedIds((prev) =>
        new Set([...prev, item.googlePlaceId])
      )
      onItemSaved()
    } catch (error) {
      console.error("Save error:", error)
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.googlePlaceId)
        return next
      })
    }
  }

  const sortedResults = [...results].sort((a, b) => {
    if (sortField === "travelTime") {
      return (a.travelTimeMinutes ?? 999) - (b.travelTimeMinutes ?? 999)
    }
    if (sortField === "rating") {
      return (b.rating ?? 0) - (a.rating ?? 0)
    }
    return a.name.localeCompare(b.name)
  })

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
          placeholder={searchPlaceholder}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
          dir="rtl"
        />
        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "\u05D7\u05E4\u05E9"}
        </button>
      </div>

      {/* Accommodation selector */}
      {accommodations && accommodations.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{"חפש ליד:"}</span>
          <select
            value={selectedAccommodationIdx}
            onChange={(e) => setSelectedAccommodationIdx(Number(e.target.value))}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
            dir="rtl"
          >
            {accommodations.map((acc, i) => (
              <option key={i} value={i}>
                {acc.name || acc.address || `לינה ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {/* Sort options */}
      {!loading && results.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{"\u05DE\u05D9\u05D5\u05DF:"}</span>
          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
            {([
              { value: "travelTime" as const, label: "\u05D6\u05DE\u05DF \u05E0\u05E1\u05D9\u05E2\u05D4" },
              { value: "rating" as const, label: "\u05D3\u05D9\u05E8\u05D5\u05D2" },
              { value: "name" as const, label: "\u05E9\u05DD" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortField(opt.value)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  sortField === opt.value
                    ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results grid */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedResults.map((item) => (
            <CardComponent
              key={item.googlePlaceId}
              item={item}
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
            {"\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D5 \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA. \u05E0\u05E1\u05D4 \u05D7\u05D9\u05E4\u05D5\u05E9 \u05D0\u05D7\u05E8."}
          </span>
        </div>
      )}

      {/* Initial state */}
      {!loading && !searched && (
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/50">
          <span className="text-sm text-zinc-400">
            {emptyStateText}
          </span>
        </div>
      )}
    </div>
  )
}
