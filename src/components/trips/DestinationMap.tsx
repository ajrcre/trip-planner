"use client"

import { useEffect, useRef, useState } from "react"
import { loadMapsLibrary, loadMarkerLibrary } from "@/lib/google-maps-loader"

interface DestinationMapProps {
  center: { lat: number; lng: number }
  destinationName: string
}

export function DestinationMap({ center, destinationName }: DestinationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let marker: google.maps.marker.AdvancedMarkerElement | null = null

    async function initMap() {
      if (!mapRef.current) return

      try {
        const { Map } = await loadMapsLibrary()
        const { AdvancedMarkerElement, PinElement } =
          await loadMarkerLibrary()

        const map = new Map(mapRef.current, {
          center,
          zoom: 6,
          mapId: "destination-overview-map",
        })

        const pin = new PinElement({
          background: "#ef4444",
          borderColor: "#dc2626",
          glyphColor: "#ffffff",
          scale: 1.2,
        })

        marker = new AdvancedMarkerElement({
          map,
          position: center,
          title: destinationName,
          content: pin.element,
        })

        setLoading(false)
      } catch (err) {
        console.error("Failed to load map:", err)
        setError("שגיאה בטעינת המפה")
        setLoading(false)
      }
    }

    initMap()

    return () => {
      if (marker) {
        marker.map = null
      }
    }
  }, [center, destinationName])

  if (error) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
          <span className="text-sm text-zinc-400">טוען מפה...</span>
        </div>
      )}
      <div ref={mapRef} className="h-72 w-full" />
    </div>
  )
}
