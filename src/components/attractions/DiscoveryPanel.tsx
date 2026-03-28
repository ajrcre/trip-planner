"use client"

import { DiscoveryPanel as GenericDiscoveryPanel, type DiscoveryConfig } from "@/components/discovery/DiscoveryPanel"
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
  websiteUri?: string | null
  openingHours?: string[] | null
  travelTimeMinutes?: number | null
  distanceKm?: number | null
}

interface DiscoveryPanelProps {
  tripId: string
  savedPlaceIds: Set<string>
  onAttractionSaved: () => void
  accommodations?: Array<{ name?: string; address?: string; coordinates?: { lat: number; lng: number } }>
}

const quickFilters = [
  { label: "טבע", query: "nature" },
  { label: "מוזיאונים", query: "museums" },
  { label: "פארקים", query: "parks" },
  { label: "חופים", query: "beaches" },
  { label: "היסטורי", query: "historical sites" },
  { label: "משפחות", query: "family friendly activities" },
]

function AttractionCardAdapter({
  item,
  savedIds,
  onSave,
}: {
  item: DiscoveredAttraction
  savedIds: Set<string>
  onSave: (item: DiscoveredAttraction, status: string) => void
}) {
  return (
    <AttractionCard
      attraction={item}
      savedIds={savedIds}
      onSave={onSave}
    />
  )
}

export function DiscoveryPanel({
  tripId,
  savedPlaceIds,
  onAttractionSaved,
  accommodations,
}: DiscoveryPanelProps) {
  const config: DiscoveryConfig<DiscoveredAttraction> = {
    discoverEndpoint: "attractions/discover",
    saveEndpoint: "attractions",
    quickFilters,
    CardComponent: AttractionCardAdapter,
    buildSavePayload: (item, status) => ({
      googlePlaceId: item.googlePlaceId,
      name: item.name,
      description: item.description,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      ratingGoogle: item.rating,
      photos: item.photos,
      website: item.websiteUri,
      openingHours: item.openingHours ? { weekdayDescriptions: item.openingHours } : undefined,
      status,
    }),
    onItemSaved: onAttractionSaved,
    searchPlaceholder: "חפש אטרקציות",
    emptyStateText: "חפש אטרקציות או בחר קטגוריה למעלה",
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
