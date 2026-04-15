"use client"

import { useState, useCallback, useEffect } from "react"
import { DiscoveryPanel as RestaurantDiscoveryPanel } from "@/components/restaurants/DiscoveryPanel"
import { RestaurantTable } from "@/components/restaurants/RestaurantTable"
import type { Trip } from "../TripDashboard"
import type { TripRole } from "@/types/sharing"

interface SavedRestaurant {
  id: string
  googlePlaceId: string | null
  name: string
  cuisineType: string | null
  address: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  website: string | null
  openingHours: unknown
  ratingGoogle: number | null
  travelTimeMinutes: number | null
  kidFriendly: boolean
  status: string
}

export function RestaurantsTab({ trip, role }: { trip: Trip; role: TripRole }) {
  const canEdit = role !== "viewer"
  const [subView, setSubView] = useState<"discover" | "my">(
    trip.restaurants.length > 0 ? "my" : canEdit ? "discover" : "my"
  )
  const [savedRestaurants, setSavedRestaurants] = useState<SavedRestaurant[]>(
    trip.restaurants as unknown as SavedRestaurant[]
  )

  const fetchRestaurants = useCallback(async () => {
    try {
      const response = await fetch(`/api/trips/${trip.id}/restaurants`)
      if (response.ok) {
        const data = await response.json()
        setSavedRestaurants(data)
      }
    } catch (error) {
      console.error("Failed to fetch restaurants:", error)
    }
  }, [trip.id])

  useEffect(() => {
    fetchRestaurants()
  }, [fetchRestaurants])

  const savedPlaceIds = new Set(
    savedRestaurants
      .filter((r) => r.googlePlaceId)
      .map((r) => r.googlePlaceId as string)
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
          המסעדות שלי
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
            גלה מסעדות
          </button>
        )}
      </div>

      {/* Content */}
      {subView === "discover" ? (
        <RestaurantDiscoveryPanel
          tripId={trip.id}
          savedPlaceIds={savedPlaceIds}
          onRestaurantSaved={fetchRestaurants}
          accommodations={trip.accommodation ?? undefined}
        />
      ) : (
        <RestaurantTable
          tripId={trip.id}
          restaurants={savedRestaurants}
          onUpdate={fetchRestaurants}
        />
      )}
    </div>
  )
}
