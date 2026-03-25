"use client"

import { useState, useRef, useCallback } from "react"
import type { ExtractedTripDetails } from "@/lib/gemini"

interface FileUploadZoneProps {
  tripId?: string
  onExtracted: (data: ExtractedTripDetails, fileName: string) => void
}

export function FileUploadZone({ tripId, onExtracted }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

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

        const url = tripId ? `/api/trips/${tripId}/extract` : "/api/extract"
        const res = await fetch(url, { method: "POST", body: formData })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "שגיאה בחילוץ פרטים")
        }

        const data: ExtractedTripDetails = await res.json()
        onExtracted(data, file.name)
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה בחילוץ פרטים מהקובץ")
      } finally {
        setIsExtracting(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [tripId, onExtracted]
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

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
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
            <p className="text-sm text-zinc-500">מנתח את הקובץ {fileName ? `(${fileName})` : ""}...</p>
          </>
        ) : (
          <>
            <svg className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm text-zinc-500">גרור קובץ לכאן או לחץ לבחירה</p>
            <p className="text-xs text-zinc-400">PDF, JPG, PNG (עד 10MB)</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
