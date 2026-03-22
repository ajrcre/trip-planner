"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps"
import type { ActivityData } from "./ActivityCard"

interface ItineraryMapProps {
  activities: ActivityData[]
  allDayPlans?: { id: string; date: string; activities: ActivityData[] }[]
  activeActivityId: string | null
  onMarkerClick: (activityId: string) => void
  accommodations: { name: string; lat?: number; lng?: number }[]
}

const typeColors: Record<string, string> = {
  lodging: "#3B82F6",    // blue
  attraction: "#F97316", // orange
  meal: "#EF4444",       // red
  travel: "#8B5CF6",     // purple
  rest: "#6B7280",       // gray
  custom: "#22C55E",     // green
}

function getActivityLocation(
  activity: ActivityData,
  accommodations: { name: string; lat?: number; lng?: number }[]
): { lat: number; lng: number } | null {
  // Attractions
  if (activity.attraction?.lat != null && activity.attraction?.lng != null) {
    return { lat: activity.attraction.lat, lng: activity.attraction.lng }
  }
  // Restaurants
  if (activity.restaurant?.lat != null && activity.restaurant?.lng != null) {
    return { lat: activity.restaurant.lat, lng: activity.restaurant.lng }
  }
  // Lodging: match accommodation by name from notes
  if (activity.type === "lodging" && activity.notes) {
    const match = accommodations.find(
      (a) => a.name && activity.notes?.includes(a.name)
    )
    if (match?.lat != null && match?.lng != null) {
      return { lat: match.lat, lng: match.lng }
    }
  }
  // Fallback: check all accommodations for lodging type
  if (activity.type === "lodging" && accommodations.length > 0) {
    const first = accommodations[0]
    if (first.lat != null && first.lng != null) {
      return { lat: first.lat, lng: first.lng }
    }
  }
  return null
}

function getActivityName(activity: ActivityData): string {
  if (activity.attraction) return activity.attraction.name
  if (activity.restaurant) return activity.restaurant.name
  if (activity.notes) return activity.notes
  return activity.type
}

// Sub-component: Renders driving route polylines
function DirectionsRenderer({
  markers,
}: {
  markers: { lat: number; lng: number }[]
}) {
  const map = useMap()

  useEffect(() => {
    if (!map || markers.length < 2) return

    const directionsService = new google.maps.DirectionsService()
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#3B82F6",
        strokeWeight: 3,
        strokeOpacity: 0.7,
      },
    })

    const origin = markers[0]
    const destination = markers[markers.length - 1]
    const waypoints = markers.slice(1, -1).map((m) => ({
      location: new google.maps.LatLng(m.lat, m.lng),
      stopover: true,
    }))

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        waypoints: waypoints.slice(0, 23), // max 23 waypoints
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRenderer.setDirections(result)
        }
      }
    )

    return () => {
      directionsRenderer.setMap(null)
    }
  }, [map, markers])

  return null
}

// Sub-component: Auto-fit bounds to show all markers
function MapBoundsHandler({
  markers,
}: {
  markers: { lat: number; lng: number }[]
}) {
  const map = useMap()

  useEffect(() => {
    if (!map || markers.length === 0) return

    const bounds = new google.maps.LatLngBounds()
    markers.forEach((m) => bounds.extend(new google.maps.LatLng(m.lat, m.lng)))

    if (markers.length === 1) {
      map.setCenter(markers[0])
      map.setZoom(14)
    } else {
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 })
    }
  }, [map, markers])

  return null
}

export function ItineraryMap({
  activities,
  allDayPlans,
  activeActivityId,
  onMarkerClick,
  accommodations,
}: ItineraryMapProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showAllDays, setShowAllDays] = useState(false)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_CLIENT_KEY ?? ""

  // Determine which activities to show
  const displayActivities = useMemo(() => {
    if (showAllDays && allDayPlans) {
      return allDayPlans.flatMap((day) => day.activities)
    }
    return activities
  }, [showAllDays, allDayPlans, activities])

  // Build markers with location data
  const markersData = useMemo(() => {
    return displayActivities
      .map((activity, index) => {
        const loc = getActivityLocation(activity, accommodations)
        if (!loc) return null
        return {
          id: activity.id,
          lat: loc.lat,
          lng: loc.lng,
          index: index + 1,
          type: activity.type,
          name: getActivityName(activity),
          timeStart: activity.timeStart,
          activity,
        }
      })
      .filter(Boolean) as {
      id: string
      lat: number
      lng: number
      index: number
      type: string
      name: string
      timeStart: string | null
      activity: ActivityData
    }[]
  }, [displayActivities, accommodations])

  const markerPositions = useMemo(
    () => markersData.map((m) => ({ lat: m.lat, lng: m.lng })),
    [markersData]
  )

  const handleMarkerClick = useCallback(
    (markerId: string) => {
      setSelectedMarkerId((prev) => (prev === markerId ? null : markerId))
      onMarkerClick(markerId)
    },
    [onMarkerClick]
  )

  // Sync selected marker with external activeActivityId
  useEffect(() => {
    if (activeActivityId) {
      setSelectedMarkerId(activeActivityId)
    }
  }, [activeActivityId])

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
        מפתח Google Maps לא מוגדר
      </div>
    )
  }

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        <span>🗺️</span>
        <span>הצג מפה</span>
      </button>
    )
  }

  const defaultCenter =
    markersData.length > 0
      ? { lat: markersData[0].lat, lng: markersData[0].lng }
      : { lat: 32.0853, lng: 34.7818 } // Tel Aviv fallback

  const selectedMarker = markersData.find((m) => m.id === selectedMarkerId)

  return (
    <div className="flex flex-col gap-2">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            מפת מסלול
          </h3>
          {allDayPlans && allDayPlans.length > 1 && (
            <button
              onClick={() => setShowAllDays((v) => !v)}
              className="rounded-full border border-zinc-300 px-3 py-0.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              {showAllDays ? "יום נוכחי" : "כל הימים"}
            </button>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          title="סגור מפה"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Map */}
      <div className="h-[400px] overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={defaultCenter}
            defaultZoom={12}
            mapId="itinerary-map"
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: "100%", height: "100%" }}
          >
            <MapBoundsHandler markers={markerPositions} />
            {markerPositions.length >= 2 && (
              <DirectionsRenderer markers={markerPositions} />
            )}

            {markersData.map((marker) => {
              const isActive = activeActivityId === marker.id
              const color = typeColors[marker.type] ?? typeColors.custom

              return (
                <AdvancedMarker
                  key={marker.id}
                  position={{ lat: marker.lat, lng: marker.lng }}
                  onClick={() => handleMarkerClick(marker.id)}
                >
                  <div
                    className="flex items-center justify-center rounded-full text-white text-xs font-bold shadow-lg transition-transform"
                    style={{
                      backgroundColor: color,
                      width: isActive ? 36 : 28,
                      height: isActive ? 36 : 28,
                      border: isActive
                        ? "3px solid white"
                        : "2px solid white",
                      boxShadow: isActive
                        ? `0 0 0 3px ${color}, 0 2px 8px rgba(0,0,0,0.3)`
                        : "0 2px 6px rgba(0,0,0,0.3)",
                      transform: isActive ? "scale(1.2)" : "scale(1)",
                      zIndex: isActive ? 10 : 1,
                    }}
                  >
                    {marker.index}
                  </div>
                </AdvancedMarker>
              )
            })}

            {selectedMarker && (
              <InfoWindow
                position={{
                  lat: selectedMarker.lat,
                  lng: selectedMarker.lng,
                }}
                onCloseClick={() => setSelectedMarkerId(null)}
              >
                <div className="p-1 text-sm" dir="rtl">
                  <p className="font-semibold">{selectedMarker.name}</p>
                  {selectedMarker.timeStart && (
                    <p className="text-xs text-zinc-500">
                      {selectedMarker.timeStart}
                    </p>
                  )}
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>

      {/* Legend */}
      {markersData.length === 0 && (
        <p className="text-center text-xs text-zinc-400">
          אין פעילויות עם מיקום להצגה על המפה
        </p>
      )}
    </div>
  )
}
