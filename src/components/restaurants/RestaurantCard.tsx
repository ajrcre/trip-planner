"use client"

import { ItemCard, type DiscoveredItem } from "@/components/shared/ItemCard"

export interface DiscoveredRestaurant extends DiscoveredItem {
  cuisineType: string | null
}

interface RestaurantCardProps {
  restaurant: DiscoveredRestaurant
  savedIds: Set<string>
  onSave: (restaurant: DiscoveredRestaurant, status: string) => void
}

function NameWithCuisine({ restaurant }: { restaurant: DiscoveredRestaurant }) {
  return (
    <div className="flex items-start gap-2">
      <h3 className="flex-1 text-sm font-semibold leading-tight">
        {restaurant.name}
      </h3>
      {restaurant.cuisineType && (
        <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
          {restaurant.cuisineType}
        </span>
      )}
    </div>
  )
}

export function RestaurantCard({
  restaurant,
  savedIds,
  onSave,
}: RestaurantCardProps) {
  return (
    <ItemCard
      item={restaurant}
      savedIds={savedIds}
      onSave={onSave}
      gradientClasses="from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30"
      headerTextClasses="text-orange-700 dark:text-orange-300"
      typeContent={<NameWithCuisine restaurant={restaurant} />}
    />
  )
}
