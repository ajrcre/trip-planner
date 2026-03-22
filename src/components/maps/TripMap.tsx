"use client"

import { useEffect, useRef, useState } from "react"
import { loadMapsLibrary, loadMarkerLibrary } from "@/lib/google-maps-loader"

interface MarkerData {
  lat: number
  lng: number
  name: string
}

interface TripMapProps {
  center: { lat: number; lng: number }
  accommodations?: MarkerData[]
  attractions?: MarkerData[]
  restaurants?: MarkerData[]
  zoom?: number
}

export function TripMap({
  center,
  accommodations = [],
  attractions = [],
  restaurants = [],
  zoom = 13,
}: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const markers: google.maps.marker.AdvancedMarkerElement[] = []

    async function initMap() {
      if (!mapRef.current) return

      try {
        const { Map, InfoWindow } = await loadMapsLibrary()
        const { AdvancedMarkerElement, PinElement } =
          await loadMarkerLibrary()

        const map = new Map(mapRef.current, {
          center,
          zoom,
          mapId: "trip-planner-map",
        })

        const infoWindow = new InfoWindow()

        function addMarker(
          position: { lat: number; lng: number },
          title: string,
          color: string
        ) {
          const pin = new PinElement({
            background: color,
            borderColor: color,
            glyphColor: "#ffffff",
          })

          const marker = new AdvancedMarkerElement({
            map,
            position,
            title,
            content: pin.element,
          })

          marker.addListener("click", () => {
            const div = document.createElement("div")
            div.style.cssText = "font-size:14px;font-weight:500;padding:4px 0;"
            div.textContent = title
            infoWindow.setContent(div)
            infoWindow.open({ anchor: marker, map })
          })

          markers.push(marker)
        }

        // Accommodation markers (blue)
        if (accommodations.length > 0) {
          for (const acc of accommodations) {
            addMarker({ lat: acc.lat, lng: acc.lng }, acc.name, "#3b82f6")
          }
        } else {
          addMarker(center, "לינה", "#3b82f6")
        }

        // Attraction markers (green)
        for (const attraction of attractions) {
          addMarker(
            { lat: attraction.lat, lng: attraction.lng },
            attraction.name,
            "#22c55e"
          )
        }

        // Restaurant markers (orange)
        for (const restaurant of restaurants) {
          addMarker(
            { lat: restaurant.lat, lng: restaurant.lng },
            restaurant.name,
            "#f97316"
          )
        }

        setLoading(false)
      } catch (err) {
        console.error("Failed to load map:", err)
        setError("שגיאה בטעינת המפה")
        setLoading(false)
      }
    }

    initMap()

    return () => {
      for (const marker of markers) {
        marker.map = null
      }
    }
  }, [center, accommodations, attractions, restaurants, zoom])

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
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
      <div ref={mapRef} className="h-64 w-full" />
    </div>
  )
}
