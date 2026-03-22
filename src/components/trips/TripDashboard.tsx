"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { FileUploadExtractor } from "@/components/trips/FileUploadExtractor"
import { TripMap } from "@/components/maps/TripMap"
import { DiscoveryPanel } from "@/components/attractions/DiscoveryPanel"
import { AttractionTable } from "@/components/attractions/AttractionTable"
import { DiscoveryPanel as RestaurantDiscoveryPanel } from "@/components/restaurants/DiscoveryPanel"
import { RestaurantTable } from "@/components/restaurants/RestaurantTable"
import { ScheduleView } from "@/components/schedule/ScheduleView"
import { PackingList } from "@/components/lists/PackingList"
import { ShoppingList } from "@/components/lists/ShoppingList"
import { DestinationOverview } from "@/components/trips/DestinationOverview"
import { normalizeAccommodations } from "@/lib/accommodations"

interface Trip {
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
  destinationInfo: any | null
  attractions: unknown[]
  restaurants: unknown[]
  dayPlans: unknown[]
  packingItems: unknown[]
  shoppingItems: unknown[]
}

const tabs = [
  { key: "overview", label: "סקירה כללית" },
  { key: "destination", label: "יעד" },
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

function EditableField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
      />
    </div>
  )
}

function OverviewTab({ trip, onUpdated }: { trip: Trip; onUpdated?: () => void }) {
  const accommodations = normalizeAccommodations(trip.accommodation)
  const flights = trip.flights
  const car = trip.carRental

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Edit state
  const [editFlights, setEditFlights] = useState({
    outbound: {
      flightNumber: flights?.outbound?.flightNumber || "",
      departureAirport: flights?.outbound?.departureAirport || "",
      departureTime: flights?.outbound?.departureTime || "",
      arrivalAirport: flights?.outbound?.arrivalAirport || "",
      arrivalTime: flights?.outbound?.arrivalTime || "",
    },
    return: {
      flightNumber: flights?.return?.flightNumber || "",
      departureAirport: flights?.return?.departureAirport || "",
      departureTime: flights?.return?.departureTime || "",
      arrivalAirport: flights?.return?.arrivalAirport || "",
      arrivalTime: flights?.return?.arrivalTime || "",
    },
  })

  const [editAccommodations, setEditAccommodations] = useState(
    accommodations.map((a) => ({
      name: a.name || "",
      address: a.address || "",
      checkIn: a.checkIn || "",
      checkOut: a.checkOut || "",
      contact: a.contact || "",
      bookingReference: a.bookingReference || "",
    }))
  )

  const [editCar, setEditCar] = useState({
    company: car?.company || "",
    pickupLocation: car?.pickupLocation || "",
    returnLocation: car?.returnLocation || "",
    additionalDetails: car?.additionalDetails || "",
  })

  const handleStartEdit = () => {
    setEditFlights({
      outbound: {
        flightNumber: flights?.outbound?.flightNumber || "",
        departureAirport: flights?.outbound?.departureAirport || "",
        departureTime: flights?.outbound?.departureTime || "",
        arrivalAirport: flights?.outbound?.arrivalAirport || "",
        arrivalTime: flights?.outbound?.arrivalTime || "",
      },
      return: {
        flightNumber: flights?.return?.flightNumber || "",
        departureAirport: flights?.return?.departureAirport || "",
        departureTime: flights?.return?.departureTime || "",
        arrivalAirport: flights?.return?.arrivalAirport || "",
        arrivalTime: flights?.return?.arrivalTime || "",
      },
    })
    setEditAccommodations(
      accommodations.map((a) => ({
        name: a.name || "",
        address: a.address || "",
        checkIn: a.checkIn || "",
        checkOut: a.checkOut || "",
        contact: a.contact || "",
        bookingReference: a.bookingReference || "",
      }))
    )
    setEditCar({
      company: car?.company || "",
      pickupLocation: car?.pickupLocation || "",
      returnLocation: car?.returnLocation || "",
      additionalDetails: car?.additionalDetails || "",
    })
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    setIsSaving(true)
    try {
      const hasFlights = Object.values(editFlights.outbound).some(Boolean) || Object.values(editFlights.return).some(Boolean)
      const validAccommodations = editAccommodations.filter((a) => Object.values(a).some(Boolean))
      const hasCar = Object.values(editCar).some(Boolean)

      const body: Record<string, unknown> = {}
      if (hasFlights) {
        body.flights = {
          outbound: Object.values(editFlights.outbound).some(Boolean) ? editFlights.outbound : null,
          return: Object.values(editFlights.return).some(Boolean) ? editFlights.return : null,
        }
      } else {
        body.flights = null
      }
      body.accommodation = validAccommodations.length > 0 ? validAccommodations : null
      body.carRental = hasCar ? editCar : null

      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setIsEditing(false)
        onUpdated?.()
      }
    } catch (error) {
      console.error("Failed to save:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-6">
        {/* Flights Edit */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-4 text-lg font-semibold">טיסות</h3>
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">טיסת הלוך</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EditableField label="מספר טיסה" value={editFlights.outbound.flightNumber} onChange={(v) => setEditFlights((p) => ({ ...p, outbound: { ...p.outbound, flightNumber: v } }))} />
              <EditableField label="שדה תעופה יציאה" value={editFlights.outbound.departureAirport} onChange={(v) => setEditFlights((p) => ({ ...p, outbound: { ...p.outbound, departureAirport: v } }))} />
              <EditableField label="זמן יציאה" value={editFlights.outbound.departureTime} onChange={(v) => setEditFlights((p) => ({ ...p, outbound: { ...p.outbound, departureTime: v } }))} type="datetime-local" />
              <EditableField label="שדה תעופה נחיתה" value={editFlights.outbound.arrivalAirport} onChange={(v) => setEditFlights((p) => ({ ...p, outbound: { ...p.outbound, arrivalAirport: v } }))} />
              <EditableField label="זמן נחיתה" value={editFlights.outbound.arrivalTime} onChange={(v) => setEditFlights((p) => ({ ...p, outbound: { ...p.outbound, arrivalTime: v } }))} type="datetime-local" />
            </div>
            <h4 className="mt-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">טיסת חזור</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <EditableField label="מספר טיסה" value={editFlights.return.flightNumber} onChange={(v) => setEditFlights((p) => ({ ...p, return: { ...p.return, flightNumber: v } }))} />
              <EditableField label="שדה תעופה יציאה" value={editFlights.return.departureAirport} onChange={(v) => setEditFlights((p) => ({ ...p, return: { ...p.return, departureAirport: v } }))} />
              <EditableField label="זמן יציאה" value={editFlights.return.departureTime} onChange={(v) => setEditFlights((p) => ({ ...p, return: { ...p.return, departureTime: v } }))} type="datetime-local" />
              <EditableField label="שדה תעופה נחיתה" value={editFlights.return.arrivalAirport} onChange={(v) => setEditFlights((p) => ({ ...p, return: { ...p.return, arrivalAirport: v } }))} />
              <EditableField label="זמן נחיתה" value={editFlights.return.arrivalTime} onChange={(v) => setEditFlights((p) => ({ ...p, return: { ...p.return, arrivalTime: v } }))} type="datetime-local" />
            </div>
          </div>
        </div>

        {/* Accommodation Edit */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-4 text-lg font-semibold">לינה</h3>
          <div className="flex flex-col gap-4">
            {editAccommodations.map((acc, idx) => (
              <div key={idx} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-600 relative">
                {editAccommodations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEditAccommodations((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-2 left-2 text-zinc-400 hover:text-red-500 text-lg leading-none"
                  >
                    ×
                  </button>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <EditableField label="שם" value={acc.name} onChange={(v) => setEditAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, name: v } : a))} />
                  <EditableField label="כתובת" value={acc.address} onChange={(v) => setEditAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, address: v } : a))} />
                  <EditableField label="צ'ק-אין" value={acc.checkIn} onChange={(v) => setEditAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, checkIn: v } : a))} type="datetime-local" />
                  <EditableField label="צ'ק-אאוט" value={acc.checkOut} onChange={(v) => setEditAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, checkOut: v } : a))} type="datetime-local" />
                  <EditableField label="פרטי קשר" value={acc.contact} onChange={(v) => setEditAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, contact: v } : a))} />
                  <EditableField label="מספר הזמנה" value={acc.bookingReference} onChange={(v) => setEditAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, bookingReference: v } : a))} />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEditAccommodations((prev) => [...prev, { name: "", address: "", checkIn: "", checkOut: "", contact: "", bookingReference: "" }])}
              className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400"
            >
              + הוסף לינה
            </button>
          </div>
        </div>

        {/* Car Rental Edit */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-4 text-lg font-semibold">השכרת רכב</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditableField label="חברה" value={editCar.company} onChange={(v) => setEditCar((p) => ({ ...p, company: v }))} />
            <EditableField label="מיקום איסוף" value={editCar.pickupLocation} onChange={(v) => setEditCar((p) => ({ ...p, pickupLocation: v }))} />
            <EditableField label="מיקום החזרה" value={editCar.returnLocation} onChange={(v) => setEditCar((p) => ({ ...p, returnLocation: v }))} />
            <EditableField label="פרטים נוספים" value={editCar.additionalDetails} onChange={(v) => setEditCar((p) => ({ ...p, additionalDetails: v }))} />
          </div>
        </div>

        {/* Save/Cancel */}
        <div className="flex gap-3">
          <button
            onClick={handleSaveEdit}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "שומר..." : "שמור"}
          </button>
          <button
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            ביטול
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Edit button */}
      <div className="flex justify-end">
        <button
          onClick={handleStartEdit}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
        >
          ערוך פרטים
        </button>
      </div>

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
      {accommodations.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 text-lg font-semibold">לינה</h3>
          <div className="flex flex-col gap-4">
            {accommodations.map((acc, idx) => (
              <div key={idx} className={idx > 0 ? "border-t border-zinc-200 pt-4 dark:border-zinc-700" : ""}>
                {accommodations.length > 1 && acc.name && (
                  <p className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{acc.name}</p>
                )}
                <div className="flex flex-col gap-2">
                  {accommodations.length === 1 && <InfoRow label="שם" value={acc.name} />}
                  <InfoRow label="כתובת" value={acc.address} />
                  <InfoRow label="צ'ק-אין" value={acc.checkIn ? formatDateTime(acc.checkIn) : undefined} />
                  <InfoRow label="צ'ק-אאוט" value={acc.checkOut ? formatDateTime(acc.checkOut) : undefined} />
                  <InfoRow label="פרטי קשר" value={acc.contact} />
                  <InfoRow label="מספר הזמנה" value={acc.bookingReference} />
                </div>
              </div>
            ))}
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

      {/* File Upload Extractor */}
      <FileUploadExtractor tripId={trip.id} onUpdated={onUpdated} />

      {/* Map */}
      {(() => {
        const mapCenter = accommodations.find((a) => a.coordinates)?.coordinates
        return mapCenter ? (
          <TripMap
            center={mapCenter}
            attractions={(trip.attractions as Array<{ lat: number; lng: number; name: string }>) ?? []}
            restaurants={(trip.restaurants as Array<{ lat: number; lng: number; name: string }>) ?? []}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/50">
            <span className="text-sm text-zinc-400">הוסף כתובת לינה כדי לראות מפה</span>
          </div>
        )
      })()}
    </div>
  )
}

function ListsTab({ tripId }: { tripId: string }) {
  const [listTab, setListTab] = useState<"packing" | "shopping">("packing")

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 self-start rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        <button
          onClick={() => setListTab("packing")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            listTab === "packing"
              ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          רשימת ציוד
        </button>
        <button
          onClick={() => setListTab("shopping")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            listTab === "shopping"
              ? "bg-white text-green-600 shadow-sm dark:bg-zinc-700 dark:text-green-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          רשימת קניות
        </button>
      </div>

      {/* Content */}
      {listTab === "packing" ? (
        <PackingList tripId={tripId} />
      ) : (
        <ShoppingList tripId={tripId} />
      )}
    </div>
  )
}

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

function AttractionsTab({ trip }: { trip: Trip }) {
  const [subView, setSubView] = useState<"discover" | "my">(
    trip.attractions.length > 0 ? "my" : "discover"
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
          savedRestaurants={restaurantOptions}
        />
      )}
    </div>
  )
}

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

function RestaurantsTab({ trip }: { trip: Trip }) {
  const [subView, setSubView] = useState<"discover" | "my">(
    trip.restaurants.length > 0 ? "my" : "discover"
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
      </div>

      {/* Content */}
      {subView === "discover" ? (
        <RestaurantDiscoveryPanel
          tripId={trip.id}
          savedPlaceIds={savedPlaceIds}
          onRestaurantSaved={fetchRestaurants}
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

function ShareExportButtons({ tripId, tripName }: { tripId: string; tripName: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showSharePopover, setShowSharePopover] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSharePopover(false)
      }
    }
    if (showSharePopover) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showSharePopover])

  async function handleShare() {
    setShareLoading(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        const fullUrl = `${window.location.origin}${data.url}`
        setShareUrl(fullUrl)
        setShowSharePopover(true)
      }
    } catch (error) {
      console.error("Failed to generate share link:", error)
    } finally {
      setShareLoading(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea")
      textarea.value = shareUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleExport() {
    setExportLoading(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/export`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${tripName}.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("Failed to export:", error)
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="relative flex gap-2">
      <button
        onClick={handleShare}
        disabled={shareLoading}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
      >
        {shareLoading ? "..." : "שתף"}
      </button>
      <button
        onClick={handleExport}
        disabled={exportLoading}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
      >
        {exportLoading ? "..." : "ייצא"}
      </button>

      {showSharePopover && shareUrl && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 z-50 mt-2 w-80 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-600 dark:bg-zinc-800"
        >
          <h4 className="mb-2 text-sm font-semibold">קישור לשיתוף</h4>
          <p className="mb-3 text-xs text-zinc-500">
            כל מי שיקבל את הקישור יוכל לצפות בטיול (קריאה בלבד)
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
              dir="ltr"
            />
            <button
              onClick={handleCopy}
              className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {copied ? "הועתק!" : "העתק"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ScheduleTab({ trip }: { trip: Trip }) {
  const [attractions, setAttractions] = useState<{ id: string; name: string; status: string }[]>([])
  const [restaurants, setRestaurants] = useState<{ id: string; name: string; status: string }[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const [attRes, restRes] = await Promise.all([
          fetch(`/api/trips/${trip.id}/attractions`),
          fetch(`/api/trips/${trip.id}/restaurants`),
        ])
        if (attRes.ok) {
          const data = await attRes.json()
          setAttractions(data.map((a: { id: string; name: string; status: string }) => ({
            id: a.id,
            name: a.name,
            status: a.status,
          })))
        }
        if (restRes.ok) {
          const data = await restRes.json()
          setRestaurants(data.map((r: { id: string; name: string; status: string }) => ({
            id: r.id,
            name: r.name,
            status: r.status,
          })))
        }
      } catch (error) {
        console.error("Failed to fetch data for schedule:", error)
      }
    }
    fetchData()
  }, [trip.id])

  return (
    <ScheduleView
      trip={{
        id: trip.id,
        startDate: trip.startDate,
        endDate: trip.endDate,
        accommodation: trip.accommodation,
        flights: trip.flights,
        attractions,
        restaurants,
      }}
    />
  )
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{trip.name}</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
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
      {activeTab === "schedule" && <ScheduleTab trip={trip} />}
      {activeTab === "lists" && <ListsTab tripId={trip.id} />}
    </div>
  )
}
