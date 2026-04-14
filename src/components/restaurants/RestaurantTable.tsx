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

interface SavedRestaurant extends BaseItem {
  cuisineType: string | null
  kidFriendly: boolean
}

interface RestaurantTableProps {
  tripId: string
  restaurants: SavedRestaurant[]
  onUpdate: () => void
}

type RestaurantSortField = "name" | "travelTime" | "rating"

const sortComparators: Record<RestaurantSortField, (a: SavedRestaurant, b: SavedRestaurant) => number> = {
  name: commonComparators.byName,
  travelTime: commonComparators.byTravelTime,
  rating: commonComparators.byRating,
}

const sortOptions = [
  { value: "name", label: "מיון: שם" },
  { value: "travelTime", label: "מיון: זמן נסיעה" },
  { value: "rating", label: "מיון: דירוג" },
]

export function RestaurantTable({
  tripId,
  restaurants,
  onUpdate,
}: RestaurantTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { filter, setFilter, sortField, setSortField, sorted } = useTableFiltering<SavedRestaurant, RestaurantSortField>({
    items: restaurants,
    defaultSort: "name",
    sortComparators,
  })

  const { updatingId, handleStatusChange, handleDelete, handleFieldUpdate } = useItemActions({
    tripId,
    entityPath: "restaurants",
    onUpdate,
  })

  async function handleKidFriendlyToggle(id: string, current: boolean) {
    await handleFieldUpdate(id, { kidFriendly: !current })
  }

  const columns = useMemo((): ColumnDef<SavedRestaurant>[] => [
    nameColumn<SavedRestaurant>(),
    // Cuisine type column (restaurant-specific)
    {
      key: "cuisineType",
      header: "סוג אוכל",
      render: (item) =>
        item.cuisineType ? (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
            {item.cuisineType}
          </span>
        ) : (
          "—"
        ),
    },
    travelTimeColumn<SavedRestaurant>(),
    ratingColumn<SavedRestaurant>(),
    openingHoursColumn<SavedRestaurant>(),
    statusColumn<SavedRestaurant>(handleStatusChange, updatingId),
    linksColumn<SavedRestaurant>(),
    deleteColumn<SavedRestaurant>(handleDelete, updatingId),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [updatingId])

  return (
    <ItemTable<SavedRestaurant>
      items={restaurants}
      sorted={sorted}
      columns={columns}
      sortOptions={sortOptions}
      sortField={sortField}
      setSortField={(f) => setSortField(f as RestaurantSortField)}
      filter={filter}
      setFilter={setFilter}
      updatingId={updatingId}
      expandedId={expandedId}
      setExpandedId={setExpandedId}
      handleStatusChange={handleStatusChange}
      handleDelete={handleDelete}
      emptyMessage={'עדיין לא נשמרו מסעדות. עבור ללשונית "גלה מסעדות" כדי לחפש.'}
      rowClickToExpand={true}
      renderExpanded={(restaurant) => (
        <div className="bg-zinc-50 px-4 py-3 dark:bg-zinc-900/50">
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
        </div>
      )}
    />
  )
}
