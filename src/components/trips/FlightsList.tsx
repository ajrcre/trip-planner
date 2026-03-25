"use client"

import { InputField } from "./InputField"

interface FlightFormData {
  _id: number
  flightNumber: string
  departureAirport: string
  departureTime: string
  arrivalAirport: string
  arrivalTime: string
}

interface FlightsListProps {
  items: FlightFormData[]
  onChange: (items: FlightFormData[]) => void
}

let _nextFlightId = 1
export function makeEmptyFlight(): FlightFormData {
  return { _id: _nextFlightId++, flightNumber: "", departureAirport: "", departureTime: "", arrivalAirport: "", arrivalTime: "" }
}

export function FlightsList({ items, onChange }: FlightsListProps) {
  const updateItem = (idx: number, field: keyof FlightFormData, value: string) => {
    onChange(items.map((f, i) => i === idx ? { ...f, [field]: value } : f))
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((flight, idx) => (
        <div key={flight._id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-600 relative">
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="absolute top-2 left-2 text-zinc-400 hover:text-red-500 text-lg leading-none"
            >
              ×
            </button>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="מספר טיסה" value={flight.flightNumber} onChange={(v) => updateItem(idx, "flightNumber", v)} />
            <div />
            <InputField label="שדה תעופה - יציאה" value={flight.departureAirport} onChange={(v) => updateItem(idx, "departureAirport", v)} />
            <InputField label="שעת יציאה" type="datetime-local" value={flight.departureTime} onChange={(v) => updateItem(idx, "departureTime", v)} />
            <InputField label="שדה תעופה - נחיתה" value={flight.arrivalAirport} onChange={(v) => updateItem(idx, "arrivalAirport", v)} />
            <InputField label="שעת נחיתה" type="datetime-local" value={flight.arrivalTime} onChange={(v) => updateItem(idx, "arrivalTime", v)} />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, makeEmptyFlight()])}
        className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400"
      >
        + הוסף טיסה
      </button>
    </div>
  )
}

export type { FlightFormData }
