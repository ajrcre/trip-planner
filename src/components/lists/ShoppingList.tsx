"use client"

import { useState, useEffect, useCallback } from "react"
import { ChecklistManager, type ChecklistConfig, type TranslationConfig } from "./ChecklistManager"
import { getSpeechLang } from "@/components/shared/SpeakButton"

const SHOPPING_CONFIG: ChecklistConfig = {
  apiPath: "shopping",
  colorScheme: { primary: "green", light: "green" },
  labels: {
    progressLabel: "נקנו",
    emptyState: "אין פריטים ברשימת הקניות",
    addPlaceholder: "הוסף פריט...",
  },
}

export function ShoppingList({ tripId }: { tripId: string }) {
  const [countryCode, setCountryCode] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function fetchDestination() {
      try {
        const res = await fetch(`/api/trips/${tripId}`)
        if (res.ok) {
          const trip = await res.json()
          const code = trip.destinationInfo?.countryCode as string | undefined
          if (code) setCountryCode(code)
        }
      } catch (err) {
        console.error("Failed to fetch trip destination info:", err)
      }
    }
    fetchDestination()
  }, [tripId])

  const handleTranslate = useCallback(async () => {
    setTranslating(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/shopping/translate`, {
        method: "POST",
      })
      if (res.ok) {
        setRefreshKey((k) => k + 1)
      }
    } catch (err) {
      console.error("Failed to translate shopping items:", err)
    } finally {
      setTranslating(false)
    }
  }, [tripId])

  const translation: TranslationConfig | undefined = countryCode
    ? {
        speechLang: getSpeechLang(countryCode),
        onTranslate: handleTranslate,
        translating,
      }
    : undefined

  return (
    <ChecklistManager
      key={refreshKey}
      tripId={tripId}
      config={SHOPPING_CONFIG}
      translation={translation}
    />
  )
}
