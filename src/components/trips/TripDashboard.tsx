"use client"

import { useState, useCallback, useEffect } from "react"
import { TripMap } from "@/components/maps/TripMap"
import { DiscoveryPanel } from "@/components/attractions/DiscoveryPanel"
import { AttractionTable } from "@/components/attractions/AttractionTable"

interface Trip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  accommodation: {
    name?: string
    address?: string
    checkIn?: string
    checkOut?: string
    contact?: string
    bookingReference?: string
    coordinates?: { lat: number; lng: number }
  } | null
  flights: {
    outbound?: {
      flightNumber?: string
      departureAirport?: string
      departureTime?: string
      arrivalAirport?: string
      arrivalTime?: string
    }
    return?: {
      flightNumber?: string
      departureAirport?: string
      departureTime?: string
      arrivalAirport?: string
      arrivalTime?: string
    }
  } | null
  carRental: {
    company?: string
    pickupLocation?: string
    returnLocation?: string
    additionalDetails?: string
  } | null
  attractions: unknown[]
  restaurants: unknown[]
  dayPlans: unknown[]
  packingItems: unknown[]
  shoppingItems: unknown[]
}

const tabs = [
  { key: "overview", label: "סקירה כללית" },
  { key: "attractions", label: "אטרקציות" },
  { key: "restaurants", label: "מסעדות" },
  { key: "schedule", label: 'לו"ז' },
  { key: "lists", label: "רשימות" },
] as const

type TabKey = (typeof tabs)[number]["key"]

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("he-IL")
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-medium text-zinc-600 dark:text-zinc-400">{label}:</span>
      <span>{value}</span>
    </div>
  )
}

function OverviewTab({ trip }: { trip: Trip }) {
  const acc = trip.accommodation
  const flights = trip.flights
  const car = trip.carRental

  return (
    <div className="flex flex-col gap-6">
      {/* Dates */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <h3 className="mb-3 text-lg font-semibold">תאריכים</h3>
        <div className="flex gap-4 text-sm">
          <span>{formatDate(trip.startDate)}</span>
          <span>—</span>
          <span>{formatDate(trip.endDate)}</span>
        </div>
      </div>

      {/* Accommodation */}
      {acc && (acc.name || acc.address) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 text-lg font-semibold">לינה</h3>
          <div className="flex flex-col gap-2">
            <InfoRow label="שם" value={acc.name} />
            <InfoRow label="כתובת" value={acc.address} />
            <InfoRow label="צ'ק-אין" value={acc.checkIn ? formatDateTime(acc.checkIn) : undefined} />
            <InfoRow label="צ'ק-אאוט" value={acc.checkOut ? formatDateTime(acc.checkOut) : undefined} />
            <InfoRow label="פרטי קשר" value={acc.contact} />
            <InfoRow label="מספר הזמנה" value={acc.bookingReference} />
          </div>
        </div>
      )}

      {/* Flights */}
      {flights && (flights.outbound?.flightNumber || flights.return?.flightNumber) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 text-lg font-semibold">טיסות</h3>
          <div className="flex flex-col gap-4">
            {flights.outbound?.flightNumber && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">טיסת הלוך</h4>
                <div className="flex flex-col gap-1">
                  <InfoRow label="מספר טיסה" value={flights.outbound.flightNumber} />
                  <InfoRow
                    label="יציאה"
                    value={
                      flights.outbound.departureAirport
                        ? `${flights.outbound.departureAirport}${flights.outbound.departureTime ? ` - ${formatDateTime(flights.outbound.departureTime)}` : ""}`
                        : undefined
                    }
                  />
                  <InfoRow
                    label="נחיתה"
                    value={
                      flights.outbound.arrivalAirport
                        ? `${flights.outbound.arrivalAirport}${flights.outbound.arrivalTime ? ` - ${formatDateTime(flights.outbound.arrivalTime)}` : ""}`
                        : undefined
                    }
                  />
                </div>
              </div>
            )}
            {flights.return?.flightNumber && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">טיסת חזור</h4>
                <div className="flex flex-col gap-1">
                  <InfoRow label="מספר טיסה" value={flights.return.flightNumber} />
                  <InfoRow
                    label="יציאה"
                    value={
                      flights.return.departureAirport
                        ? `${flights.return.departureAirport}${flights.return.departureTime ? ` - ${formatDateTime(flights.return.departureTime)}` : ""}`
                        : undefined
                    }
                  />
                  <InfoRow
                    label="נחיתה"
                    value={
                      flights.return.arrivalAirport
                        ? `${flights.return.arrivalAirport}${flights.return.arrivalTime ? ` - ${formatDateTime(flights.return.arrivalTime)}` : ""}`
                        : undefined
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Car Rental */}
      {car && (car.company || car.pickupLocation) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 text-lg font-semibold">השכרת רכב</h3>
          <div className="flex flex-col gap-2">
            <InfoRow label="חברה" value={car.company} />
            <InfoRow label="מיקום איסוף" value={car.pickupLocation} />
            <InfoRow label="מיקום החזרה" value={car.returnLocation} />
            <InfoRow label="פרטים נוספים" value={car.additionalDetails} />
          </div>
        </div>
      )}

      {/* Map */}
      {acc?.coordinates ? (
        <TripMap
          center={acc.coordinates}
          attractions={(trip.attractions as Array<{ lat: number; lng: number; name: string }>) ?? []}
          restaurants={(trip.restaurants as Array<{ lat: number; lng: number; name: string }>) ?? []}
        />
      ) : (
        <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/50">
          <span className="text-sm text-zinc-400">הוסף כתובת לינה כדי לראות מפה</span>
        </div>
      )}
    </div>
  )
}

function PlaceholderTab() {
  return (
    <div className="flex h-64 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <span className="text-lg text-zinc-400">בקרוב</span>
    </div>
  )
}

interface SavedAttraction {
  id: string
  googlePlaceId: string | null
  name: string
  description: string | null
  address: string | null
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
}

function AttractionsTab({ trip }: { trip: Trip }) {
  const [subView, setSubView] = useState<"discover" | "my">(
    trip.attractions.length > 0 ? "my" : "discover"
  )
  const [savedAttractions, setSavedAttractions] = useState<SavedAttraction[]>(
    trip.attractions as unknown as SavedAttraction[]
  )

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

  useEffect(() => {
    fetchAttractions()
  }, [fetchAttractions])

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
      </div>

      {/* Content */}
      {subView === "discover" ? (
        <DiscoveryPanel
          tripId={trip.id}
          savedPlaceIds={savedPlaceIds}
          onAttractionSaved={fetchAttractions}
        />
      ) : (
        <AttractionTable
          tripId={trip.id}
          attractions={savedAttractions}
          onUpdate={fetchAttractions}
        />
      )}
    </div>
  )
}

export function TripDashboard({ trip }: { trip: Trip }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview")

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{trip.name}</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {trip.destination} | {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
        </p>
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
      {activeTab === "overview" && <OverviewTab trip={trip} />}
      {activeTab === "attractions" && <AttractionsTab trip={trip} />}
      {activeTab !== "overview" && activeTab !== "attractions" && <PlaceholderTab />}
    </div>
  )
}
