"use client"

import { useState, useCallback } from "react"

interface MergeItem<T> {
  data: T
  source: "existing" | "new"
  checked: boolean
}

interface MergeCategoryProps<T> {
  title: string
  items: MergeItem<T>[]
  renderItem: (item: T) => React.ReactNode
  onToggle: (index: number) => void
}

function MergeCategory<T>({ title, items, renderItem, onToggle }: MergeCategoryProps<T>) {
  if (items.length === 0) return null

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <label key={idx} className="flex items-start gap-3 cursor-pointer rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => onToggle(idx)}
              className="mt-1 h-4 w-4 rounded border-zinc-300"
            />
            <div className="flex-1">
              <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium mb-1 ${
                item.source === "existing"
                  ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              }`}>
                {item.source === "existing" ? "קיים" : "חדש"}
              </span>
              {renderItem(item.data)}
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

function renderFlight(f: Record<string, unknown>) {
  const parts = [f.flightNumber, [f.departureAirport, f.arrivalAirport].filter(Boolean).join(" → ")]
    .filter(Boolean)
  return <span className="text-sm">{parts.join(" | ")}</span>
}

function renderAccommodation(a: Record<string, unknown>) {
  const parts = [a.name, a.address].filter(Boolean)
  return <span className="text-sm">{parts.join(" - ")}</span>
}

function renderCarRental(c: Record<string, unknown>) {
  const parts = [c.company, c.pickupLocation].filter(Boolean)
  return <span className="text-sm">{parts.join(" - ")}</span>
}

interface MergeReviewProps {
  existingFlights: Record<string, unknown>[]
  newFlights: Record<string, unknown>[]
  existingAccommodation: Record<string, unknown>[]
  newAccommodation: Record<string, unknown>[]
  existingCarRentals: Record<string, unknown>[]
  newCarRentals: Record<string, unknown>[]
  onConfirm: (result: {
    flights: Record<string, unknown>[]
    accommodation: Record<string, unknown>[]
    carRental: Record<string, unknown>[]
  }) => void
  onCancel: () => void
  isSaving?: boolean
}

export function MergeReview({
  existingFlights, newFlights,
  existingAccommodation, newAccommodation,
  existingCarRentals, newCarRentals,
  onConfirm, onCancel, isSaving,
}: MergeReviewProps) {
  const buildItems = <T,>(existing: T[], newItems: T[]): MergeItem<T>[] => [
    ...existing.map((data) => ({ data, source: "existing" as const, checked: true })),
    ...newItems.map((data) => ({ data, source: "new" as const, checked: true })),
  ]

  const [flights, setFlights] = useState(() => buildItems(existingFlights, newFlights))
  const [accommodation, setAccommodation] = useState(() => buildItems(existingAccommodation, newAccommodation))
  const [carRentals, setCarRentals] = useState(() => buildItems(existingCarRentals, newCarRentals))

  const toggle = <T,>(items: MergeItem<T>[], setItems: (items: MergeItem<T>[]) => void) =>
    (idx: number) => setItems(items.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item))

  const handleConfirm = useCallback(() => {
    onConfirm({
      flights: flights.filter((i) => i.checked).map((i) => i.data) as Record<string, unknown>[],
      accommodation: accommodation.filter((i) => i.checked).map((i) => i.data) as Record<string, unknown>[],
      carRental: carRentals.filter((i) => i.checked).map((i) => i.data) as Record<string, unknown>[],
    })
  }, [flights, accommodation, carRentals, onConfirm])

  const hasContent = flights.length > 0 || accommodation.length > 0 || carRentals.length > 0

  if (!hasContent) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
        נמצאו פרטים חדשים. בחר מה לשמור:
      </div>

      <MergeCategory title="טיסות" items={flights} renderItem={renderFlight} onToggle={toggle(flights, setFlights)} />
      <MergeCategory title="לינה" items={accommodation} renderItem={renderAccommodation} onToggle={toggle(accommodation, setAccommodation)} />
      <MergeCategory title="השכרת רכב" items={carRentals} renderItem={renderCarRental} onToggle={toggle(carRentals, setCarRentals)} />

      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={isSaving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "שומר..." : "אשר ושמור"}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          ביטול
        </button>
      </div>
    </div>
  )
}
