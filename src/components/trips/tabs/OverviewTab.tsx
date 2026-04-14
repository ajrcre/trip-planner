"use client"

import { useState, useCallback } from "react"
import { FileUploadZone } from "../FileUploadZone"
import { MergeReview } from "../MergeReview"
import { FlightsList, makeEmptyFlight, type FlightFormData } from "../FlightsList"
import { AccommodationsList, makeEmptyAccommodation, type AccommodationFormData } from "../AccommodationsList"
import { CarRentalsList, makeEmptyCarRental, type CarRentalFormData } from "../CarRentalsList"
import { normalizeFlights, normalizeCarRentals } from "@/lib/normalizers"
import type { ExtractedTripDetails } from "@/lib/gemini"
import { TripMap } from "@/components/maps/TripMap"
import { normalizeAccommodations } from "@/lib/accommodations"
import type { Trip } from "../TripDashboard"
import { formatUiDateTime } from "@/lib/format-time"

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("he-IL")
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

export function OverviewTab({ trip, onUpdated }: { trip: Trip; onUpdated?: () => void }) {
  const accommodations = normalizeAccommodations(trip.accommodation)
  const flightsData = normalizeFlights(trip.flights)
  const carRentalsData = normalizeCarRentals(trip.carRental)

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Merge state
  const [mergeData, setMergeData] = useState<ExtractedTripDetails | null>(null)
  const [isSavingMerge, setIsSavingMerge] = useState(false)

  // Edit state
  const [editFlights, setEditFlights] = useState<FlightFormData[]>([makeEmptyFlight()])
  const [editAccommodations, setEditAccommodations] = useState<AccommodationFormData[]>([makeEmptyAccommodation()])
  const [editCarRentals, setEditCarRentals] = useState<CarRentalFormData[]>([makeEmptyCarRental()])

  const handleStartEdit = () => {
    let id = Date.now()
    setEditFlights(
      flightsData.length > 0
        ? flightsData.map(f => ({ _id: id++, flightNumber: f.flightNumber || "", departureAirport: f.departureAirport || "", departureTime: f.departureTime || "", arrivalAirport: f.arrivalAirport || "", arrivalTime: f.arrivalTime || "" }))
        : [makeEmptyFlight()]
    )
    setEditAccommodations(
      accommodations.length > 0
        ? accommodations.map(a => ({ _id: id++, name: a.name || "", address: a.address || "", website: a.website || "", checkIn: a.checkIn || "", checkOut: a.checkOut || "", contact: a.contact || "", bookingReference: a.bookingReference || "" }))
        : [makeEmptyAccommodation()]
    )
    setEditCarRentals(
      carRentalsData.length > 0
        ? carRentalsData.map(r => ({ _id: id++, company: r.company || "", pickupLocation: r.pickupLocation || "", pickupTime: r.pickupTime || "", returnLocation: r.returnLocation || "", returnTime: r.returnTime || "", additionalDetails: r.additionalDetails || "" }))
        : [makeEmptyCarRental()]
    )
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    setIsSaving(true)
    try {
      const validFlights = editFlights
        .filter(f => f.flightNumber || f.departureAirport || f.arrivalAirport)
        .map(({ _id, ...rest }) => rest)
      const validAccommodations = editAccommodations
        .filter(a => a.name || a.address || a.website || a.checkIn || a.checkOut || a.contact || a.bookingReference)
        .map(({ _id, ...rest }) => rest)
      const validCarRentals = editCarRentals
        .filter(r => r.company || r.pickupLocation || r.returnLocation)
        .map(({ _id, ...rest }) => rest)

      const body: Record<string, unknown> = {
        flights: validFlights.length > 0 ? validFlights : null,
        accommodation: validAccommodations.length > 0 ? validAccommodations : null,
        carRental: validCarRentals.length > 0 ? validCarRentals : null,
      }

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

  const handleExtracted = useCallback((data: ExtractedTripDetails, _fileName: string) => {
    const hasExistingOverlap =
      (flightsData.length > 0 && data.flights && data.flights.length > 0) ||
      (accommodations.length > 0 && data.accommodation && data.accommodation.length > 0) ||
      (carRentalsData.length > 0 && data.carRental && data.carRental.length > 0)

    if (hasExistingOverlap) {
      setMergeData(data)
    } else {
      const body: Record<string, unknown> = {}
      if (data.flights?.length) body.flights = [...flightsData, ...data.flights]
      if (data.accommodation?.length) body.accommodation = [...accommodations, ...data.accommodation]
      if (data.carRental?.length) body.carRental = [...carRentalsData, ...data.carRental]
      if (Object.keys(body).length > 0) {
        fetch(`/api/trips/${trip.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(() => onUpdated?.())
      }
    }
  }, [trip.id, flightsData, accommodations, carRentalsData, onUpdated])

  const handleMergeConfirm = useCallback(async (result: { flights: Record<string, unknown>[]; accommodation: Record<string, unknown>[]; carRental: Record<string, unknown>[] }) => {
    setIsSavingMerge(true)
    try {
      await fetch(`/api/trips/${trip.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      })
      setMergeData(null)
      onUpdated?.()
    } finally {
      setIsSavingMerge(false)
    }
  }, [trip.id, onUpdated])

  if (isEditing) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-4 text-lg font-semibold">טיסות</h3>
          <FlightsList items={editFlights} onChange={setEditFlights} />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-4 text-lg font-semibold">לינה</h3>
          <AccommodationsList items={editAccommodations} onChange={setEditAccommodations} />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-4 text-lg font-semibold">השכרת רכב</h3>
          <CarRentalsList items={editCarRentals} onChange={setEditCarRentals} />
        </div>

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
                  <InfoRow label="אתר" value={acc.website ?? undefined} />
                  <InfoRow label="צ'ק-אין" value={acc.checkIn ? formatUiDateTime(acc.checkIn) : undefined} />
                  <InfoRow label="צ'ק-אאוט" value={acc.checkOut ? formatUiDateTime(acc.checkOut) : undefined} />
                  <InfoRow label="פרטי קשר" value={acc.contact} />
                  <InfoRow label="מספר הזמנה" value={acc.bookingReference} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flights */}
      {flightsData.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 text-lg font-semibold">טיסות</h3>
          <div className="flex flex-col gap-4">
            {flightsData.map((flight, idx) => (
              <div key={idx} className={idx > 0 ? "border-t border-zinc-200 pt-4 dark:border-zinc-700" : ""}>
                <div className="flex flex-col gap-1">
                  <InfoRow label="מספר טיסה" value={flight.flightNumber} />
                  <InfoRow
                    label="יציאה"
                    value={flight.departureAirport
                      ? `${flight.departureAirport}${flight.departureTime ? ` - ${formatUiDateTime(flight.departureTime)}` : ""}`
                      : undefined}
                  />
                  <InfoRow
                    label="נחיתה"
                    value={flight.arrivalAirport
                      ? `${flight.arrivalAirport}${flight.arrivalTime ? ` - ${formatUiDateTime(flight.arrivalTime)}` : ""}`
                      : undefined}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Car Rentals */}
      {carRentalsData.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 text-lg font-semibold">השכרת רכב</h3>
          <div className="flex flex-col gap-4">
            {carRentalsData.map((rental, idx) => (
              <div key={idx} className={idx > 0 ? "border-t border-zinc-200 pt-4 dark:border-zinc-700" : ""}>
                <div className="flex flex-col gap-2">
                  <InfoRow label="חברה" value={rental.company} />
                  <InfoRow label="מיקום איסוף" value={rental.pickupLocation} />
                  <InfoRow label="מיקום החזרה" value={rental.returnLocation} />
                  <InfoRow label="פרטים נוספים" value={rental.additionalDetails} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Upload */}
      <FileUploadZone tripId={trip.id} onExtracted={handleExtracted} />
      {mergeData && (
        <MergeReview
          existingFlights={flightsData as unknown as Record<string, unknown>[]}
          newFlights={(mergeData.flights || []) as unknown as Record<string, unknown>[]}
          existingAccommodation={accommodations as unknown as Record<string, unknown>[]}
          newAccommodation={(mergeData.accommodation || []) as unknown as Record<string, unknown>[]}
          existingCarRentals={carRentalsData as unknown as Record<string, unknown>[]}
          newCarRentals={(mergeData.carRental || []) as unknown as Record<string, unknown>[]}
          onConfirm={handleMergeConfirm}
          onCancel={() => setMergeData(null)}
          isSaving={isSavingMerge}
        />
      )}

      {/* Map */}
      {(() => {
        const mapCenter = accommodations.find((a) => a.coordinates)?.coordinates
        return mapCenter ? (
          <TripMap
            center={mapCenter}
            accommodations={accommodations.filter((a) => a.coordinates).map((a) => ({
              lat: a.coordinates!.lat, lng: a.coordinates!.lng, name: a.name || "לינה"
            }))}
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
