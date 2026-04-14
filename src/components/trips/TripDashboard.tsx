"use client"

import { useState, useCallback } from "react"
import { OverviewTab } from "./tabs/OverviewTab"
import { AttractionsTab } from "./tabs/AttractionsTab"
import { RestaurantsTab } from "./tabs/RestaurantsTab"
import { GroceryStoresTab } from "./tabs/GroceryStoresTab"
import { ScheduleTab } from "./tabs/ScheduleTab"
import { ListsTab } from "./tabs/ListsTab"
import { ShareExportButtons } from "./ShareExportButtons"
import { DestinationOverview } from "@/components/trips/DestinationOverview"

export interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  accommodation: Array<{
    name?: string
    address?: string
    checkIn?: string
    checkOut?: string
    contact?: string
    bookingReference?: string
    coordinates?: { lat: number; lng: number }
  }> | null
  flights: unknown
  carRental: unknown
  destinationInfo: any | null
  attractions: unknown[]
  restaurants: unknown[]
  groceryStores: unknown[]
  dayPlans: unknown[]
  packingItems: unknown[]
  shoppingItems: unknown[]
}

const tabs = [
  { key: "overview", label: "סקירה כללית" },
  { key: "destination", label: "יעד" },
  { key: "schedule", label: 'לו"ז' },
  { key: "attractions", label: "אטרקציות" },
  { key: "restaurants", label: "מסעדות" },
  { key: "groceryStores", label: "סופר" },
  { key: "lists", label: "רשימות" },
] as const

type TabKey = (typeof tabs)[number]["key"]

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("he-IL")
}

export function TripDashboard({ trip: initialTrip }: { trip: Trip }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
  const [trip, setTrip] = useState<Trip>(initialTrip)

  const refreshTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${trip.id}`)
      if (res.ok) {
        const data = await res.json()
        setTrip(data)
      }
    } catch (error) {
      console.error("Failed to refresh trip:", error)
    }
  }, [trip.id])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold">{trip.name}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {trip.destination} | {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
          </p>
        </div>
        <ShareExportButtons tripId={trip.id} tripName={trip.name} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab trip={trip} onUpdated={refreshTrip} />}
      {activeTab === "destination" && (
        <DestinationOverview
          tripId={trip.id}
          destination={trip.destination}
          destinationInfo={trip.destinationInfo}
          onGenerated={refreshTrip}
        />
      )}
      {activeTab === "attractions" && <AttractionsTab trip={trip} />}
      {activeTab === "restaurants" && <RestaurantsTab trip={trip} />}
      {activeTab === "groceryStores" && <GroceryStoresTab trip={trip} />}
      {activeTab === "schedule" && <ScheduleTab trip={trip} />}
      {activeTab === "lists" && <ListsTab tripId={trip.id} />}
    </div>
  )
}
