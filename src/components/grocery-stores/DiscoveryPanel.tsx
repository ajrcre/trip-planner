"use client"

import { DiscoveryPanel as GenericDiscoveryPanel, type DiscoveryConfig } from "@/components/discovery/DiscoveryPanel"
import { GroceryStoreCard, type DiscoveredGroceryStore } from "./GroceryStoreCard"

interface DiscoveryPanelProps {
  tripId: string
  savedPlaceIds: Set<string>
  onStoreSaved: () => void
  accommodations?: Array<{ name?: string; address?: string; coordinates?: { lat: number; lng: number } }>
}

const quickFilters = [
  { label: "סופרמרקט", query: "supermarket" },
  { label: "מכולת", query: "convenience store" },
  { label: "אורגני", query: "organic grocery store" },
  { label: "כשר", query: "kosher grocery store" },
  { label: "שוק מקומי", query: "local market" },
]

function GroceryStoreCardAdapter({
  item,
  savedIds,
  onSave,
}: {
  item: DiscoveredGroceryStore
  savedIds: Set<string>
  onSave: (item: DiscoveredGroceryStore, status: string) => void
}) {
  return (
    <GroceryStoreCard
      store={item}
      savedIds={savedIds}
      onSave={onSave}
    />
  )
}

export function DiscoveryPanel({
  tripId,
  savedPlaceIds,
  onStoreSaved,
  accommodations,
}: DiscoveryPanelProps) {
  const config: DiscoveryConfig<DiscoveredGroceryStore> = {
    discoverEndpoint: "grocery-stores/discover",
    saveEndpoint: "grocery-stores",
    quickFilters,
    CardComponent: GroceryStoreCardAdapter,
    buildSavePayload: (item, status) => ({
      googlePlaceId: item.googlePlaceId,
      name: item.name,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      ratingGoogle: item.rating,
      photos: item.photos,
      storeType: item.storeType,
      website: item.websiteUri,
      openingHours: item.openingHours ? { weekdayDescriptions: item.openingHours } : undefined,
      types: item.types,
      status,
    }),
    onItemSaved: onStoreSaved,
    searchPlaceholder: "חפש חנויות מכולת",
    emptyStateText: "חפש חנויות מכולת או בחר קטגוריה למעלה",
  }

  return (
    <GenericDiscoveryPanel
      tripId={tripId}
      savedPlaceIds={savedPlaceIds}
      config={config}
      accommodations={accommodations}
    />
  )
}
