"use client"

import { ItemCard, type DiscoveredItem } from "@/components/shared/ItemCard"

export interface DiscoveredGroceryStore extends DiscoveredItem {
  storeType: string | null
}

function NameWithStoreType({ store }: { store: DiscoveredGroceryStore }) {
  return (
    <div className="flex items-start gap-2">
      <h3 className="flex-1 text-sm font-semibold leading-tight">
        {store.name}
      </h3>
      {store.storeType && (
        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {store.storeType}
        </span>
      )}
    </div>
  )
}

export function GroceryStoreCard({
  store,
  savedIds,
  onSave,
}: {
  store: DiscoveredGroceryStore
  savedIds: Set<string>
  onSave: (item: DiscoveredGroceryStore, status: string) => void
}) {
  return (
    <ItemCard
      item={store}
      savedIds={savedIds}
      onSave={onSave}
      gradientClasses="from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30"
      headerTextClasses="text-green-700 dark:text-green-300"
      typeContent={<NameWithStoreType store={store} />}
    />
  )
}
