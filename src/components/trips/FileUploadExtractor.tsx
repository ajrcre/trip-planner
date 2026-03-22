"use client"

import { useState, useRef, useCallback } from "react"
import type { ExtractedTripDetails } from "@/lib/gemini"
import { normalizeAccommodations } from "@/lib/accommodations"

interface FileUploadExtractorProps {
  tripId: string
  existingAccommodation?: unknown
  onUpdated?: () => void
}

function formatDateTimeDisplay(dt?: string | null) {
  if (!dt) return null
  try {
    return new Date(dt).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dt
  }
}

function PreviewField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-medium text-zinc-600 dark:text-zinc-400">{label}:</span>
      <span>{value}</span>
    </div>
  )
}

export function FileUploadExtractor({ tripId, existingAccommodation, onUpdated }: FileUploadExtractorProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedTripDetails | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      setExtracted(null)

      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
      if (!allowedTypes.includes(file.type)) {
        setError("סוג קובץ לא נתמך. ניתן להעלות PDF, JPG או PNG.")
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("הקובץ גדול מדי. מקסימום 10MB.")
        return
      }

      setFileName(file.name)
      setIsExtracting(true)

      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch(`/api/trips/${tripId}/extract`, {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "שגיאה בחילוץ פרטים")
        }

        const data: ExtractedTripDetails = await res.json()
        setExtracted(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה בחילוץ פרטים מהקובץ")
      } finally {
        setIsExtracting(false)
      }
    },
    [tripId]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleConfirm = useCallback(async () => {
    if (!extracted) return
    setIsSaving(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {}
      if (extracted.flights) body.flights = extracted.flights
      if (extracted.accommodation) {
        const existing = normalizeAccommodations(existingAccommodation)
        body.accommodation = [...existing, ...extracted.accommodation]
      }
      if (extracted.carRental) body.carRental = extracted.carRental

      const res = await fetch(`/api/trips/${tripId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error("שגיאה בשמירת הפרטים")
      }

      setExtracted(null)
      setFileName(null)
      onUpdated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בשמירה")
    } finally {
      setIsSaving(false)
    }
  }, [extracted, tripId, onUpdated])

  const handleReset = useCallback(() => {
    setExtracted(null)
    setFileName(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const hasResults =
    extracted &&
    (extracted.flights ||
      (extracted.accommodation && extracted.accommodation.length > 0) ||
      extracted.carRental)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <h3 className="mb-4 text-lg font-semibold">חילוץ פרטים ממסמך</h3>

      {/* Drop zone */}
      {!extracted && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
              : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800/50 dark:hover:border-zinc-500"
          }`}
        >
          {isExtracting ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
              <p className="text-sm text-zinc-500">
                מנתח את הקובץ {fileName ? `(${fileName})` : ""}...
              </p>
            </>
          ) : (
            <>
              <svg
                className="h-10 w-10 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              <p className="text-sm text-zinc-500">
                גרור קובץ לכאן או לחץ לבחירה
              </p>
              <p className="text-xs text-zinc-400">PDF, JPG, PNG (עד 10MB)</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Extracted results preview */}
      {hasResults && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            נמצאו פרטים בקובץ {fileName ? `(${fileName})` : ""}. בדוק ואשר:
          </div>

          {/* Flights */}
          {extracted.flights && (
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
              <h4 className="mb-2 text-sm font-semibold">טיסות</h4>
              {extracted.flights.outbound && (
                <div className="mb-2">
                  <p className="mb-1 text-xs font-medium text-zinc-500">טיסת הלוך</p>
                  <div className="flex flex-col gap-1">
                    <PreviewField label="מספר טיסה" value={extracted.flights.outbound.flightNumber} />
                    <PreviewField label="יציאה" value={extracted.flights.outbound.departureAirport} />
                    <PreviewField label="זמן יציאה" value={formatDateTimeDisplay(extracted.flights.outbound.departureTime)} />
                    <PreviewField label="נחיתה" value={extracted.flights.outbound.arrivalAirport} />
                    <PreviewField label="זמן נחיתה" value={formatDateTimeDisplay(extracted.flights.outbound.arrivalTime)} />
                  </div>
                </div>
              )}
              {extracted.flights.return && (
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-500">טיסת חזור</p>
                  <div className="flex flex-col gap-1">
                    <PreviewField label="מספר טיסה" value={extracted.flights.return.flightNumber} />
                    <PreviewField label="יציאה" value={extracted.flights.return.departureAirport} />
                    <PreviewField label="זמן יציאה" value={formatDateTimeDisplay(extracted.flights.return.departureTime)} />
                    <PreviewField label="נחיתה" value={extracted.flights.return.arrivalAirport} />
                    <PreviewField label="זמן נחיתה" value={formatDateTimeDisplay(extracted.flights.return.arrivalTime)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Accommodation */}
          {extracted.accommodation && extracted.accommodation.length > 0 && (
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
              <h4 className="mb-2 text-sm font-semibold">לינה</h4>
              {extracted.accommodation.map((acc, idx) => (
                <div key={idx} className={idx > 0 ? "mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-700" : ""}>
                  {extracted.accommodation!.length > 1 && acc.name && (
                    <p className="mb-1 text-xs font-medium text-zinc-500">{acc.name}</p>
                  )}
                  <div className="flex flex-col gap-1">
                    <PreviewField label="שם" value={acc.name} />
                    <PreviewField label="כתובת" value={acc.address} />
                    <PreviewField label="צ'ק-אין" value={formatDateTimeDisplay(acc.checkIn)} />
                    <PreviewField label="צ'ק-אאוט" value={formatDateTimeDisplay(acc.checkOut)} />
                    <PreviewField label="פרטי קשר" value={acc.contact} />
                    <PreviewField label="מספר הזמנה" value={acc.bookingReference} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Car Rental */}
          {extracted.carRental && (
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
              <h4 className="mb-2 text-sm font-semibold">השכרת רכב</h4>
              <div className="flex flex-col gap-1">
                <PreviewField label="חברה" value={extracted.carRental.company} />
                <PreviewField label="מיקום איסוף" value={extracted.carRental.pickupLocation} />
                <PreviewField label="מיקום החזרה" value={extracted.carRental.returnLocation} />
                <PreviewField label="פרטים נוספים" value={extracted.carRental.additionalDetails} />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "שומר..." : "אשר ועדכן"}
            </button>
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* No results found */}
      {extracted && !hasResults && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
            לא נמצאו פרטי נסיעה בקובץ. נסה קובץ אחר.
          </div>
          <button
            onClick={handleReset}
            className="self-start rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            נסה שוב
          </button>
        </div>
      )}
    </div>
  )
}
