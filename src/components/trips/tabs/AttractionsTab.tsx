"use client"

import { useState, useCallback, useEffect } from "react"
import { DiscoveryPanel } from "@/components/attractions/DiscoveryPanel"
import { AttractionTable } from "@/components/attractions/AttractionTable"
import type { Trip } from "../TripDashboard"
import type { TripRole } from "@/types/sharing"

interface SavedAttraction {
  id: string
  googlePlaceId: string | null
  name: string
  description: string | null
  address: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  website: string | null
  openingHours: unknown
  prices: unknown
  ratingGoogle: number | null
  travelTimeMinutes: number | null
  travelDistanceKm: number | null
  bookingRequired: boolean
  specialNotes: string | null
  status: string
  nearbyRestaurantId: string | null
}

export function AttractionsTab({ trip, role }: { trip: Trip; role: TripRole }) {
  const canEdit = role !== "viewer"
  const [subView, setSubView] = useState<"discover" | "my">(
    trip.attractions.length > 0 ? "my" : canEdit ? "discover" : "my"
  )
  const [savedAttractions, setSavedAttractions] = useState<SavedAttraction[]>(
    trip.attractions as unknown as SavedAttraction[]
  )
  const [restaurantOptions, setRestaurantOptions] = useState<{ id: string; name: string }[]>([])

  const fetchAttractions = useCallback(async () => {
    try {
      const response = await fetch(`/api/trips/${trip.id}/attractions`)
      if (response.ok) {
        const data = await response.json()
        setSavedAttractions(data)
      }
    } catch (error) {
      console.error("Failed to fetch attractions:", error)
    }
  }, [trip.id])

  const fetchRestaurantOptions = useCallback(async () => {
    try {
      const response = await fetch(`/api/trips/${trip.id}/restaurants`)
      if (response.ok) {
        const data = await response.json()
        setRestaurantOptions(
          data
            .filter((r: { status: string }) => r.status !== "rejected")
            .map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))
        )
      }
    } catch (error) {
      console.error("Failed to fetch restaurant options:", error)
    }
  }, [trip.id])

  useEffect(() => {
    fetchAttractions()
    fetchRestaurantOptions()
  }, [fetchAttractions, fetchRestaurantOptions])

  const savedPlaceIds = new Set(
    savedAttractions
      .filter((a) => a.googlePlaceId)
      .map((a) => a.googlePlaceId as string)
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-view toggle */}
      <div className="flex gap-1 self-start rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        <button
          onClick={() => setSubView("my")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            subView === "my"
              ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          האטרקציות שלי
        </button>
        {canEdit && (
          <button
            onClick={() => setSubView("discover")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              subView === "discover"
                ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
            }`}
          >
            גלה
          </button>
        )}
      </div>

      {/* Content */}
      {subView === "discover" ? (
        <DiscoveryPanel
          tripId={trip.id}
          savedPlaceIds={savedPlaceIds}
          onAttractionSaved={fetchAttractions}
          accommodations={trip.accommodation ?? undefined}
        />
      ) : (
        <AttractionTable
          tripId={trip.id}
          attractions={savedAttractions}
          onUpdate={fetchAttractions}
          savedRestaurants={restaurantOptions}
        />
      )}
    </div>
  )
}
