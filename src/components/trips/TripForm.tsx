"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
}

function CollapsibleSection({ title, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 text-right"
      >
        <span className="text-lg font-semibold">{title}</span>
        <span className="text-zinc-400">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">{children}</div>}
    </div>
  )
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
  required = false,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
      />
    </label>
  )
}

interface AccommodationFormData {
  name: string
  address: string
  checkIn: string
  checkOut: string
  contact: string
  bookingReference: string
}

const emptyAccommodation: AccommodationFormData = {
  name: "", address: "", checkIn: "", checkOut: "", contact: "", bookingReference: ""
}

export function TripForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  // Basic info
  const [name, setName] = useState("")
  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Accommodation
  const [accommodations, setAccommodations] = useState<AccommodationFormData[]>([{ ...emptyAccommodation }])

  // Flights
  const [outFlightNum, setOutFlightNum] = useState("")
  const [outDepartAirport, setOutDepartAirport] = useState("")
  const [outDepartTime, setOutDepartTime] = useState("")
  const [outArriveAirport, setOutArriveAirport] = useState("")
  const [outArriveTime, setOutArriveTime] = useState("")
  const [retFlightNum, setRetFlightNum] = useState("")
  const [retDepartAirport, setRetDepartAirport] = useState("")
  const [retDepartTime, setRetDepartTime] = useState("")
  const [retArriveAirport, setRetArriveAirport] = useState("")
  const [retArriveTime, setRetArriveTime] = useState("")

  // Car Rental
  const [carCompany, setCarCompany] = useState("")
  const [carPickup, setCarPickup] = useState("")
  const [carReturn, setCarReturn] = useState("")
  const [carDetails, setCarDetails] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const accommodationData = accommodations
        .filter((a) => a.name || a.address || a.checkIn || a.checkOut || a.contact || a.bookingReference)
      const accommodation = accommodationData.length > 0 ? accommodationData : undefined

      const flights =
        outFlightNum || retFlightNum
          ? {
              outbound: {
                flightNumber: outFlightNum,
                departureAirport: outDepartAirport,
                departureTime: outDepartTime,
                arrivalAirport: outArriveAirport,
                arrivalTime: outArriveTime,
              },
              return: {
                flightNumber: retFlightNum,
                departureAirport: retDepartAirport,
                departureTime: retDepartTime,
                arrivalAirport: retArriveAirport,
                arrivalTime: retArriveTime,
              },
            }
          : undefined

      const carRental =
        carCompany || carPickup || carReturn || carDetails
          ? {
              company: carCompany,
              pickupLocation: carPickup,
              returnLocation: carReturn,
              additionalDetails: carDetails,
            }
          : undefined

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          destination,
          startDate,
          endDate,
          accommodation,
          flights,
          carRental,
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

      {/* Section 2: Accommodation */}
      <CollapsibleSection title="לינה">
        <div className="flex flex-col gap-4">
          {accommodations.map((acc, idx) => (
            <div key={idx} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-600 relative">
              {accommodations.length > 1 && (
                <button
                  type="button"
                  onClick={() => setAccommodations((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-2 left-2 text-zinc-400 hover:text-red-500 text-lg leading-none"
                >
                  ×
                </button>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField label="שם" value={acc.name} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, name: v } : a))} />
                <InputField label="כתובת" value={acc.address} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, address: v } : a))} />
                <InputField label="צ'ק-אין" type="datetime-local" value={acc.checkIn} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, checkIn: v } : a))} />
                <InputField label="צ'ק-אאוט" type="datetime-local" value={acc.checkOut} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, checkOut: v } : a))} />
                <InputField label="פרטי קשר" value={acc.contact} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, contact: v } : a))} />
                <InputField label="מספר הזמנה" value={acc.bookingReference} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, bookingReference: v } : a))} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAccommodations((prev) => [...prev, { ...emptyAccommodation }])}
            className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400"
          >
            + הוסף לינה
          </button>
        </div>
      </CollapsibleSection>

      {/* Section 3: Flights */}
      <CollapsibleSection title="טיסות">
        <div className="mb-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">טיסת הלוך</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="מספר טיסה" value={outFlightNum} onChange={setOutFlightNum} />
            <div />
            <InputField label="שדה תעופה - יציאה" value={outDepartAirport} onChange={setOutDepartAirport} />
            <InputField label="שעת יציאה" type="datetime-local" value={outDepartTime} onChange={setOutDepartTime} />
            <InputField label="שדה תעופה - נחיתה" value={outArriveAirport} onChange={setOutArriveAirport} />
            <InputField label="שעת נחיתה" type="datetime-local" value={outArriveTime} onChange={setOutArriveTime} />
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">טיסת חזור</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="מספר טיסה" value={retFlightNum} onChange={setRetFlightNum} />
            <div />
            <InputField label="שדה תעופה - יציאה" value={retDepartAirport} onChange={setRetDepartAirport} />
            <InputField label="שעת יציאה" type="datetime-local" value={retDepartTime} onChange={setRetDepartTime} />
            <InputField label="שדה תעופה - נחיתה" value={retArriveAirport} onChange={setRetArriveAirport} />
            <InputField label="שעת נחיתה" type="datetime-local" value={retArriveTime} onChange={setRetArriveTime} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 4: Car Rental */}
      <CollapsibleSection title="השכרת רכב">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="חברה" value={carCompany} onChange={setCarCompany} />
          <InputField label="מיקום איסוף" value={carPickup} onChange={setCarPickup} />
          <InputField label="מיקום החזרה" value={carReturn} onChange={setCarReturn} />
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">פרטים נוספים</span>
            <textarea
              value={carDetails}
              onChange={(e) => setCarDetails(e.target.value)}
              rows={3}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            />
          </label>
        </div>
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
