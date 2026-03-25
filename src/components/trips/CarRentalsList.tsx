"use client"

import { InputField } from "./InputField"

interface CarRentalFormData {
  _id: number
  company: string
  pickupLocation: string
  pickupTime: string
  returnLocation: string
  returnTime: string
  additionalDetails: string
}

interface CarRentalsListProps {
  items: CarRentalFormData[]
  onChange: (items: CarRentalFormData[]) => void
}

let _nextRentalId = 1
export function makeEmptyCarRental(): CarRentalFormData {
  return { _id: _nextRentalId++, company: "", pickupLocation: "", pickupTime: "", returnLocation: "", returnTime: "", additionalDetails: "" }
}

export function CarRentalsList({ items, onChange }: CarRentalsListProps) {
  const updateItem = (idx: number, field: keyof CarRentalFormData, value: string) => {
    onChange(items.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((rental, idx) => (
        <div key={rental._id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-600 relative">
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
            <InputField label="חברה" value={rental.company} onChange={(v) => updateItem(idx, "company", v)} />
            <div />
            <InputField label="מיקום איסוף" value={rental.pickupLocation} onChange={(v) => updateItem(idx, "pickupLocation", v)} />
            <InputField label="זמן איסוף" type="datetime-local" value={rental.pickupTime} onChange={(v) => updateItem(idx, "pickupTime", v)} />
            <InputField label="מיקום החזרה" value={rental.returnLocation} onChange={(v) => updateItem(idx, "returnLocation", v)} />
            <InputField label="זמן החזרה" type="datetime-local" value={rental.returnTime} onChange={(v) => updateItem(idx, "returnTime", v)} />
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">פרטים נוספים</span>
              <textarea
                value={rental.additionalDetails}
                onChange={(e) => updateItem(idx, "additionalDetails", e.target.value)}
                rows={2}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, makeEmptyCarRental()])}
        className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400"
      >
        + הוסף השכרת רכב
      </button>
    </div>
  )
}

export type { CarRentalFormData }
