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
  formatOpeningHours,
  type BaseItem,
  type ColumnDef,
} from "@/components/shared/ItemTable"
import { useTableFiltering, commonComparators } from "@/hooks/useTableFiltering"
import { useItemActions } from "@/hooks/useItemActions"

interface SavedGroceryStore extends BaseItem {
  storeType: string | null
  travelDistanceKm: number | null
}

interface GroceryStoreTableProps {
  tripId: string
  groceryStores: SavedGroceryStore[]
  onUpdate: () => void
}

type GroceryStoreSortField = "name" | "travelTime" | "rating"

const sortComparators: Record<GroceryStoreSortField, (a: SavedGroceryStore, b: SavedGroceryStore) => number> = {
  name: commonComparators.byName,
  travelTime: commonComparators.byTravelTime,
  rating: commonComparators.byRating,
}

const sortOptions = [
  { value: "name", label: "מיון: שם" },
  { value: "travelTime", label: "מיון: זמן נסיעה" },
  { value: "rating", label: "מיון: דירוג" },
]

export function GroceryStoreTable({
  tripId,
  groceryStores,
  onUpdate,
}: GroceryStoreTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { filter, setFilter, sortField, setSortField, sorted } = useTableFiltering<SavedGroceryStore, GroceryStoreSortField>({
    items: groceryStores,
    defaultSort: "name",
    sortComparators,
  })

  const { updatingId, handleStatusChange, handleDelete } = useItemActions({
    tripId,
    entityPath: "grocery-stores",
    onUpdate,
  })

  const columns = useMemo((): ColumnDef<SavedGroceryStore>[] => [
    nameColumn<SavedGroceryStore>(),
    {
      key: "storeType",
      header: "סוג",
      render: (item) =>
        item.storeType ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
            {item.storeType}
          </span>
        ) : (
          "—"
        ),
    },
    travelTimeColumn<SavedGroceryStore>(),
    ratingColumn<SavedGroceryStore>(),
    openingHoursColumn<SavedGroceryStore>(),
    statusColumn<SavedGroceryStore>(handleStatusChange, updatingId),
    linksColumn<SavedGroceryStore>(),
    deleteColumn<SavedGroceryStore>(handleDelete, updatingId),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [updatingId])

  return (
    <ItemTable<SavedGroceryStore>
      items={groceryStores}
      sorted={sorted}
      columns={columns}
      sortOptions={sortOptions}
      sortField={sortField}
      setSortField={(f) => setSortField(f as GroceryStoreSortField)}
      filter={filter}
      setFilter={setFilter}
      updatingId={updatingId}
      expandedId={expandedId}
      setExpandedId={setExpandedId}
      handleStatusChange={handleStatusChange}
      handleDelete={handleDelete}
      emptyMessage={'עדיין לא נשמרו חנויות. עבור ללשונית "גלה חנויות" כדי לחפש.'}
      rowClickToExpand={true}
      renderExpanded={(store) => (
        <div className="bg-zinc-50 px-4 py-3 dark:bg-zinc-900/50">
          <div className="flex flex-col gap-2 text-sm">
            {store.address && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">כתובת: </span>
                <span>{store.address}</span>
              </div>
            )}
            {store.phone && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">טלפון: </span>
                <span dir="ltr">{store.phone}</span>
              </div>
            )}
            {store.website && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">אתר: </span>
                <a
                  href={store.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {store.website}
                </a>
              </div>
            )}
            {formatOpeningHours(store.openingHours) && (
              <div>
                <span className="font-medium text-zinc-600 dark:text-zinc-400">שעות פתיחה: </span>
                <span>{formatOpeningHours(store.openingHours)}</span>
              </div>
            )}
            {/* Status change buttons */}
            <div className="flex gap-2 pt-2">
              {store.status !== "want" && (
                <button
                  onClick={() => handleStatusChange(store.id, "want")}
                  disabled={updatingId === store.id}
                  className="rounded-lg bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400"
                >
                  רוצה
                </button>
              )}
              {store.status !== "maybe" && (
                <button
                  onClick={() => handleStatusChange(store.id, "maybe")}
                  disabled={updatingId === store.id}
                  className="rounded-lg bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400"
                >
                  אולי
                </button>
              )}
              {store.status !== "rejected" && (
                <button
                  onClick={() => handleStatusChange(store.id, "rejected")}
                  disabled={updatingId === store.id}
                  className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400"
                >
                  לא מתאים
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    />
  )
}
