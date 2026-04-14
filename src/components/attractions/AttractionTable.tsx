"use client"

import { useState, useMemo } from "react"
import {
  ItemTable,
  nameColumn,
  travelTimeColumn,
  ratingColumn,
  openingHoursColumn,
  statusColumn,
  linksColumn,
  deleteColumn,
  googleMapsUrl,
  formatOpeningHours,
  type BaseItem,
  type ColumnDef,
} from "@/components/shared/ItemTable"
import { useTableFiltering, commonComparators } from "@/hooks/useTableFiltering"
import { useItemActions } from "@/hooks/useItemActions"

interface SavedAttraction extends BaseItem {
  description: string | null
  prices: unknown
  travelDistanceKm: number | null
  bookingRequired: boolean
  specialNotes: string | null
  nearbyRestaurantId: string | null
}

interface NearbyRestaurantOption {
  id: string
  name: string
}

interface AttractionTableProps {
  tripId: string
  attractions: SavedAttraction[]
  onUpdate: () => void
  savedRestaurants?: NearbyRestaurantOption[]
}

type AttractionSortField = "status" | "travelTime" | "rating" | "name"

const sortComparators: Record<AttractionSortField, (a: SavedAttraction, b: SavedAttraction) => number> = {
  status: commonComparators.byStatus,
  name: commonComparators.byName,
  travelTime: commonComparators.byTravelTime,
  rating: commonComparators.byRating,
}

const sortOptions = [
  { value: "status", label: "מיון: סטטוס" },
  { value: "travelTime", label: "מיון: זמן נסיעה" },
  { value: "rating", label: "מיון: דירוג" },
  { value: "name", label: "מיון: שם" },
]

function formatPrices(prices: unknown): string | null {
  if (!prices) return null
  if (typeof prices === "string") return prices
  if (typeof prices === "object" && prices !== null) {
    return JSON.stringify(prices)
  }
  return null
}

export function AttractionTable({
  tripId,
  attractions,
  onUpdate,
  savedRestaurants = [],
}: AttractionTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState("")

  const { filter, setFilter, sortField, setSortField, sorted } = useTableFiltering<SavedAttraction, AttractionSortField>({
    items: attractions,
    defaultSort: "status",
    sortComparators,
  })

  const { updatingId, handleStatusChange, handleDelete, handleFieldUpdate } = useItemActions({
    tripId,
    entityPath: "attractions",
    onUpdate,
  })

  async function handleNotesSave(id: string) {
    await handleFieldUpdate(id, { specialNotes: notesValue || null })
    setEditingNotesId(null)
  }

  async function handleNearbyRestaurantChange(id: string, restaurantId: string | null) {
    await handleFieldUpdate(id, { nearbyRestaurantId: restaurantId })
  }

  const columns = useMemo((): ColumnDef<SavedAttraction>[] => [
    nameColumn<SavedAttraction>(),
    travelTimeColumn<SavedAttraction>(),
    ratingColumn<SavedAttraction>(),
    openingHoursColumn<SavedAttraction>(),
    statusColumn<SavedAttraction>(handleStatusChange, updatingId),
    linksColumn<SavedAttraction>(),
    // Notes column (attraction-specific)
    {
      key: "notes",
      header: "הערות",
      render: (item) => {
        if (editingNotesId === item.id) {
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNotesSave(item.id)
                  if (e.key === "Escape") setEditingNotesId(null)
                }}
                className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-700"
                autoFocus
                dir="rtl"
              />
              <button
                onClick={() => handleNotesSave(item.id)}
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
              >
                {"\u2713"}
              </button>
              <button
                onClick={() => setEditingNotesId(null)}
                className="rounded bg-zinc-200 px-2 py-1 text-xs hover:bg-zinc-300 dark:bg-zinc-600"
              >
                {"\u2717"}
              </button>
            </div>
          )
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEditingNotesId(item.id)
              setNotesValue(item.specialNotes ?? "")
            }}
            className="max-w-40 truncate text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            title={item.specialNotes ?? "הוסף הערה"}
          >
            {item.specialNotes || "+ הערה"}
          </button>
        )
      },
    },
    deleteColumn<SavedAttraction>(handleDelete, updatingId),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [updatingId, editingNotesId, notesValue])

  return (
    <ItemTable<SavedAttraction>
      items={attractions}
      sorted={sorted}
      columns={columns}
      sortOptions={sortOptions}
      sortField={sortField}
      setSortField={(f) => setSortField(f as AttractionSortField)}
      filter={filter}
      setFilter={setFilter}
      updatingId={updatingId}
      expandedId={expandedId}
      setExpandedId={setExpandedId}
      handleStatusChange={handleStatusChange}
      handleDelete={handleDelete}
      emptyMessage={'עדיין לא נשמרו אטרקציות. עבור ללשונית "גלה" כדי לחפש.'}
      renderExpanded={(attraction) => (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{attraction.name}</h3>
            <button
              onClick={() => setExpandedId(null)}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              {"\u2717"} סגור
            </button>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            {attraction.description && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">תיאור: </span>
                <span>{attraction.description}</span>
              </div>
            )}
            {attraction.address && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">כתובת: </span>
                <span>{attraction.address}</span>
              </div>
            )}
            {attraction.phone && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">טלפון: </span>
                <span dir="ltr">{attraction.phone}</span>
              </div>
            )}
            {attraction.website && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">אתר: </span>
                <a
                  href={attraction.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {attraction.website}
                </a>
              </div>
            )}
            {formatOpeningHours(attraction.openingHours) && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">שעות פתיחה: </span>
                <span className="whitespace-pre-line">{formatOpeningHours(attraction.openingHours)}</span>
              </div>
            )}
            {formatPrices(attraction.prices) && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">מחירים: </span>
                <span>{formatPrices(attraction.prices)}</span>
              </div>
            )}
            {attraction.travelTimeMinutes != null && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">נסיעה מהלינה: </span>
                <span>{attraction.travelTimeMinutes} דק׳ ({attraction.travelDistanceKm} ק״מ)</span>
              </div>
            )}
            <div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">הזמנה מראש: </span>
              <span>{attraction.bookingRequired ? "כן" : "לא"}</span>
            </div>
            {attraction.specialNotes && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">הערות: </span>
                <span>{attraction.specialNotes}</span>
              </div>
            )}
            {/* Nearby restaurant */}
            {savedRestaurants.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-600 dark:text-zinc-400">מסעדה קרובה: </span>
                <select
                  value={attraction.nearbyRestaurantId ?? ""}
                  onChange={(e) =>
                    handleNearbyRestaurantChange(attraction.id, e.target.value || null)
                  }
                  disabled={updatingId === attraction.id}
                  className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  dir="rtl"
                >
                  <option value="">—</option>
                  {savedRestaurants.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    />
  )
}
