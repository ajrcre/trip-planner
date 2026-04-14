"use client"

import { InputField } from "./InputField"

interface AccommodationFormData {
  _id: number
  name: string
  address: string
  website: string
  checkIn: string
  checkOut: string
  contact: string
  bookingReference: string
}

interface AccommodationsListProps {
  items: AccommodationFormData[]
  onChange: (items: AccommodationFormData[]) => void
}

let _nextId = 1
export function makeEmptyAccommodation(): AccommodationFormData {
  return { _id: _nextId++, name: "", address: "", website: "", checkIn: "", checkOut: "", contact: "", bookingReference: "" }
}

export function AccommodationsList({ items, onChange }: AccommodationsListProps) {
  const updateItem = (idx: number, field: keyof AccommodationFormData, value: string) => {
    onChange(items.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((acc, idx) => (
        <div key={acc._id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-600 relative">
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
            <InputField label="שם" value={acc.name} onChange={(v) => updateItem(idx, "name", v)} />
            <InputField label="כתובת" value={acc.address} onChange={(v) => updateItem(idx, "address", v)} />
            <InputField label="אתר" value={acc.website} onChange={(v) => updateItem(idx, "website", v)} />
            <InputField label="צ'ק-אין" type="datetime-local" value={acc.checkIn} onChange={(v) => updateItem(idx, "checkIn", v)} />
            <InputField label="צ'ק-אאוט" type="datetime-local" value={acc.checkOut} onChange={(v) => updateItem(idx, "checkOut", v)} />
            <InputField label="פרטי קשר" value={acc.contact} onChange={(v) => updateItem(idx, "contact", v)} />
            <InputField label="מספר הזמנה" value={acc.bookingReference} onChange={(v) => updateItem(idx, "bookingReference", v)} />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, makeEmptyAccommodation()])}
        className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400"
      >
        + הוסף לינה
      </button>
    </div>
  )
}

export type { AccommodationFormData }
