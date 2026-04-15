"use client"

import { useState, useCallback, useEffect } from "react"
import { DiscoveryPanel as GroceryStoreDiscoveryPanel } from "@/components/grocery-stores/DiscoveryPanel"
import { GroceryStoreTable } from "@/components/grocery-stores/GroceryStoreTable"
import type { Trip } from "../TripDashboard"
import type { TripRole } from "@/types/sharing"

interface SavedGroceryStore {
  id: string
  googlePlaceId: string | null
  name: string
  storeType: string | null
  address: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  website: string | null
  openingHours: unknown
  ratingGoogle: number | null
  travelTimeMinutes: number | null
  travelDistanceKm: number | null
  status: string
}

export function GroceryStoresTab({ trip, role }: { trip: Trip; role: TripRole }) {
  const canEdit = role !== "viewer"
  const [subView, setSubView] = useState<"discover" | "my">(
    trip.groceryStores.length > 0 ? "my" : canEdit ? "discover" : "my"
  )
  const [savedStores, setSavedStores] = useState<SavedGroceryStore[]>(
    trip.groceryStores as unknown as SavedGroceryStore[]
  )

  const fetchStores = useCallback(async () => {
    try {
      const response = await fetch(`/api/trips/${trip.id}/grocery-stores`)
      if (response.ok) {
        const data = await response.json()
        setSavedStores(data)
      }
    } catch (error) {
      console.error("Failed to fetch grocery stores:", error)
    }
  }, [trip.id])

  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  const savedPlaceIds = new Set(
    savedStores
      .filter((s) => s.googlePlaceId)
      .map((s) => s.googlePlaceId as string)
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
          החנויות שלי
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
            גלה חנויות
          </button>
        )}
      </div>

      {/* Content */}
      {subView === "discover" ? (
        <GroceryStoreDiscoveryPanel
          tripId={trip.id}
          savedPlaceIds={savedPlaceIds}
          onStoreSaved={fetchStores}
          accommodations={trip.accommodation ?? undefined}
        />
      ) : (
        <GroceryStoreTable
          tripId={trip.id}
          groceryStores={savedStores}
          onUpdate={fetchStores}
        />
      )}
    </div>
  )
}
