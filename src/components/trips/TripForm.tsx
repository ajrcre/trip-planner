"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { FileUploadZone } from "./FileUploadZone"
import { FlightsList, makeEmptyFlight, type FlightFormData } from "./FlightsList"
import { AccommodationsList, makeEmptyAccommodation, type AccommodationFormData } from "./AccommodationsList"
import { CarRentalsList, makeEmptyCarRental, type CarRentalFormData } from "./CarRentalsList"
import { InputField } from "./InputField"
import type { ExtractedTripDetails } from "@/lib/gemini"

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  open?: boolean
  onToggle?: () => void
}

function CollapsibleSection({ title, children, open, onToggle }: CollapsibleSectionProps) {
  const [internalOpen, setInternalOpen] = useState(false)

  const isOpen = open !== undefined ? open : internalOpen
  const handleToggle = onToggle || (() => setInternalOpen((v) => !v))

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-6 py-4 text-right"
      >
        <span className="text-lg font-semibold">{title}</span>
        <span className="text-zinc-400">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">{children}</div>}
    </div>
  )
}

export function TripForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  // Basic info
  const [name, setName] = useState("")
  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Lists
  const [flights, setFlights] = useState<FlightFormData[]>([makeEmptyFlight()])
  const [accommodations, setAccommodations] = useState<AccommodationFormData[]>([makeEmptyAccommodation()])
  const [carRentals, setCarRentals] = useState<CarRentalFormData[]>([makeEmptyCarRental()])

  // Section visibility
  const [showFlights, setShowFlights] = useState(false)
  const [showAccommodation, setShowAccommodation] = useState(false)
  const [showCarRentals, setShowCarRentals] = useState(false)

  const handleExtracted = useCallback((data: ExtractedTripDetails, _fileName: string) => {
    if (data.destination && !destination) setDestination(data.destination)
    if (data.startDate && !startDate) setStartDate(data.startDate)
    if (data.endDate && !endDate) setEndDate(data.endDate)

    if (data.flights && data.flights.length > 0) {
      let nextId = Date.now()
      const newFlights = data.flights.map((f) => ({
        _id: nextId++,
        flightNumber: f.flightNumber || "",
        departureAirport: f.departureAirport || "",
        departureTime: f.departureTime || "",
        arrivalAirport: f.arrivalAirport || "",
        arrivalTime: f.arrivalTime || "",
      }))
      setFlights((prev) => {
        const nonEmpty = prev.filter((f) => f.flightNumber || f.departureAirport || f.arrivalAirport)
        return nonEmpty.length > 0 ? [...nonEmpty, ...newFlights] : newFlights
      })
      setShowFlights(true)
    }

    if (data.accommodation && data.accommodation.length > 0) {
      let nextId = Date.now() + 1000
      const newAccommodations = data.accommodation.map((a) => ({
        _id: nextId++,
        name: a.name || "",
        address: a.address || "",
        checkIn: a.checkIn || "",
        checkOut: a.checkOut || "",
        contact: a.contact || "",
        bookingReference: a.bookingReference || "",
      }))
      setAccommodations((prev) => {
        const nonEmpty = prev.filter((a) => a.name || a.address || a.checkIn || a.checkOut)
        return nonEmpty.length > 0 ? [...nonEmpty, ...newAccommodations] : newAccommodations
      })
      setShowAccommodation(true)
    }

    if (data.carRental && data.carRental.length > 0) {
      let nextId = Date.now() + 2000
      const newRentals = data.carRental.map((r) => ({
        _id: nextId++,
        company: r.company || "",
        pickupLocation: r.pickupLocation || "",
        pickupTime: r.pickupTime || "",
        returnLocation: r.returnLocation || "",
        returnTime: r.returnTime || "",
        additionalDetails: r.additionalDetails || "",
      }))
      setCarRentals((prev) => {
        const nonEmpty = prev.filter((r) => r.company || r.pickupLocation || r.returnLocation)
        return nonEmpty.length > 0 ? [...nonEmpty, ...newRentals] : newRentals
      })
      setShowCarRentals(true)
    }
  }, [destination, startDate, endDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const flightsData = flights
        .filter((f) => f.flightNumber || f.departureAirport || f.arrivalAirport)
        .map(({ _id, ...rest }) => rest)

      const accommodationData = accommodations
        .filter((a) => a.name || a.address || a.checkIn || a.checkOut || a.contact || a.bookingReference)
        .map(({ _id, ...rest }) => rest)

      const carRentalData = carRentals
        .filter((r) => r.company || r.pickupLocation || r.returnLocation)
        .map(({ _id, ...rest }) => rest)

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          destination,
          startDate,
          endDate,
          flights: flightsData.length > 0 ? flightsData : undefined,
          accommodation: accommodationData.length > 0 ? accommodationData : undefined,
          carRental: carRentalData.length > 0 ? carRentalData : undefined,
        }),
      })

      if (res.ok) {
        const trip = await res.json()
        router.push(`/trips/${trip.id}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Section 1: Basic Info */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">פרטים בסיסיים</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="שם הטיול" value={name} onChange={setName} required />
          <InputField label="יעד" value={destination} onChange={setDestination} required />
          <InputField label="תאריך התחלה" type="date" value={startDate} onChange={setStartDate} required />
          <InputField label="תאריך סיום" type="date" value={endDate} onChange={setEndDate} required />
        </div>
      </div>

      {/* Section 2: File Upload */}
      <FileUploadZone onExtracted={handleExtracted} />

      {/* Section 3: Flights */}
      <CollapsibleSection title="טיסות" open={showFlights} onToggle={() => setShowFlights((v) => !v)}>
        <FlightsList items={flights} onChange={setFlights} />
      </CollapsibleSection>

      {/* Section 4: Accommodation */}
      <CollapsibleSection title="לינה" open={showAccommodation} onToggle={() => setShowAccommodation((v) => !v)}>
        <AccommodationsList items={accommodations} onChange={setAccommodations} />
      </CollapsibleSection>

      {/* Section 5: Car Rentals */}
      <CollapsibleSection title="השכרת רכב" open={showCarRentals} onToggle={() => setShowCarRentals((v) => !v)}>
        <CarRentalsList items={carRentals} onChange={setCarRentals} />
      </CollapsibleSection>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "יוצר טיול..." : "צור טיול"}
      </button>
    </form>
  )
}
