"use client"

import { DiscoveryPanel as GenericDiscoveryPanel, type DiscoveryConfig } from "@/components/discovery/DiscoveryPanel"
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
  websiteUri?: string | null
  openingHours?: string[] | null
  travelTimeMinutes?: number | null
  distanceKm?: number | null
}

interface DiscoveryPanelProps {
  tripId: string
  savedPlaceIds: Set<string>
  onRestaurantSaved: () => void
  accommodations?: Array<{ name?: string; address?: string; coordinates?: { lat: number; lng: number } }>
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

function RestaurantCardAdapter({
  item,
  savedIds,
  onSave,
}: {
  item: DiscoveredRestaurant
  savedIds: Set<string>
  onSave: (item: DiscoveredRestaurant, status: string) => void
}) {
  return (
    <RestaurantCard
      restaurant={item}
      savedIds={savedIds}
      onSave={onSave}
    />
  )
}

export function DiscoveryPanel({
  tripId,
  savedPlaceIds,
  onRestaurantSaved,
  accommodations,
}: DiscoveryPanelProps) {
  const config: DiscoveryConfig<DiscoveredRestaurant> = {
    discoverEndpoint: "restaurants/discover",
    saveEndpoint: "restaurants",
    quickFilters,
    CardComponent: RestaurantCardAdapter,
    buildSavePayload: (item, status) => ({
      googlePlaceId: item.googlePlaceId,
      name: item.name,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      ratingGoogle: item.rating,
      photos: item.photos,
      cuisineType: item.cuisineType,
      website: item.websiteUri,
      openingHours: item.openingHours ? { weekdayDescriptions: item.openingHours } : undefined,
      types: item.types,
      status,
    }),
    onItemSaved: onRestaurantSaved,
    searchPlaceholder: "חפש מסעדות",
    emptyStateText: "חפש מסעדות או בחר קטגוריה למעלה",
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
