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
  /** Day-relevant lodging markers (name/lat/lng) for matching lodging activities */
  accommodations: { name: string; lat?: number; lng?: number }[]
  /** Full trip accommodation list by index (rest activities, indexed `restAccommodationIndex`) */
  accommodationsFull?: { name: string; lat?: number; lng?: number }[]
}

const typeColors: Record<string, string> = {
  lodging: "#3B82F6",    // blue
  attraction: "#F97316", // orange
  meal: "#EF4444",       // red
  grocery: "#0D9488",    // teal
  travel: "#8B5CF6",     // purple
  rest: "#6B7280",       // gray
  custom: "#22C55E",     // green
}

function getActivityLocation(
  activity: ActivityData,
  accommodations: { name: string; lat?: number; lng?: number }[],
  accommodationsFull?: { name: string; lat?: number; lng?: number }[]
): { lat: number; lng: number } | null {
  // Attractions
  if (activity.attraction?.lat != null && activity.attraction?.lng != null) {
    return { lat: activity.attraction.lat, lng: activity.attraction.lng }
  }
  // Restaurants
  if (activity.restaurant?.lat != null && activity.restaurant?.lng != null) {
    return { lat: activity.restaurant.lat, lng: activity.restaurant.lng }
  }
  // Grocery stores
  if (activity.groceryStore?.lat != null && activity.groceryStore?.lng != null) {
    return { lat: activity.groceryStore.lat, lng: activity.groceryStore.lng }
  }
  // Travel activities are rendered as route polylines, not markers
  if (activity.type === "travel") {
    return null
  }
  if (
    activity.type === "rest" &&
    activity.restAccommodationIndex != null &&
    accommodationsFull &&
    accommodationsFull.length > 0
  ) {
    const acc = accommodationsFull[activity.restAccommodationIndex]
    if (acc?.lat != null && acc?.lng != null) {
      return { lat: acc.lat, lng: acc.lng }
    }
    return null
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

function getActivityName(
  activity: ActivityData,
  accommodationsFull?: { name: string; lat?: number; lng?: number }[]
): string {
  if (
    activity.type === "travel" &&
    activity.travelLeg?.resolvedOrigin &&
    activity.travelLeg?.resolvedDestination
  ) {
    return `${activity.travelLeg.resolvedOrigin.label} → ${activity.travelLeg.resolvedDestination.label}`
  }
  if (
    activity.type === "rest" &&
    activity.restAccommodationIndex != null &&
    accommodationsFull &&
    accommodationsFull[activity.restAccommodationIndex]?.name
  ) {
    return `מנוחה — ${accommodationsFull[activity.restAccommodationIndex].name}`
  }
  if (activity.attraction) return activity.attraction.name
  if (activity.restaurant) return activity.restaurant.name
  if (activity.groceryStore) return activity.groceryStore.name
  if (activity.notes) return activity.notes
  return activity.type
}

/** Decode a Google encoded polyline string into lat/lng pairs */
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}

async function fetchPolyline(
  waypoints: { lat: number; lng: number }[]
): Promise<string | null> {
  if (waypoints.length < 2) return null
  const res = await fetch("/api/routes/polyline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ waypoints }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.encodedPolyline ?? null
}

function polylineFromEncoded(
  map: google.maps.Map,
  encoded: string,
  options: {
    strokeColor: string
    strokeWeight: number
    strokeOpacity: number
  }
): google.maps.Polyline {
  const path = decodePolyline(encoded)
  return new google.maps.Polyline({
    path,
    strokeColor: options.strokeColor,
    strokeWeight: options.strokeWeight,
    strokeOpacity: options.strokeOpacity,
    map,
  })
}

/** Main itinerary polyline (non-driving stops) + per driving-activity segments */
function RoutePolylineRenderer({
  mainMarkers,
  travelSegments,
  activeActivityId,
  hoverMismatch,
}: {
  mainMarkers: { lat: number; lng: number; id: string }[]
  travelSegments: {
    activityId: string
    from: { lat: number; lng: number }
    to: { lat: number; lng: number }
  }[]
  activeActivityId: string | null
  hoverMismatch: boolean
}) {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    if (mainMarkers.length < 2 && travelSegments.length === 0) return

    const polylines: google.maps.Polyline[] = []
    let cancelled = false

    async function fetchAndDraw() {
      try {
        const hasMain = mainMarkers.length >= 2
        const positions = mainMarkers.map((m) => ({ lat: m.lat, lng: m.lng }))
        const travelSegHover = travelSegments.find(
          (s) => s.activityId === activeActivityId
        )
        const activeIdx =
          activeActivityId == null
            ? -1
            : mainMarkers.findIndex((m) => m.id === activeActivityId)

        const drawEncoded = (
          encoded: string,
          opts: { strokeColor: string; strokeWeight: number; strokeOpacity: number }
        ) => {
          if (cancelled) return
          polylines.push(polylineFromEncoded(map!, encoded, opts))
        }

        const drawTravelSegments = async (highlightId: string | null) => {
          for (const s of travelSegments) {
            if (cancelled) return
            const enc = await fetchPolyline([s.from, s.to])
            if (cancelled || !enc) continue
            const hi = highlightId === s.activityId
            drawEncoded(enc, {
              strokeColor: hi ? "#7c3aed" : "#cbd5e1",
              strokeWeight: hi ? 6 : 3,
              strokeOpacity: hi ? 0.95 : 0.4,
            })
          }
        }

        if (travelSegHover) {
          if (hasMain) {
            const encoded = await fetchPolyline(positions)
            if (cancelled || !encoded) return
            drawEncoded(encoded, {
              strokeColor: "#94a3b8",
              strokeWeight: 3,
              strokeOpacity: 0.4,
            })
          }
          await drawTravelSegments(activeActivityId)
          return
        }

        if (hoverMismatch) {
          if (hasMain) {
            const encoded = await fetchPolyline(positions)
            if (cancelled || !encoded) return
            drawEncoded(encoded, {
              strokeColor: "#94a3b8",
              strokeWeight: 3,
              strokeOpacity: 0.45,
            })
          }
          await drawTravelSegments(null)
          return
        }

        if (!hasMain) {
          await drawTravelSegments(null)
          return
        }

        if (activeActivityId == null || activeIdx < 0) {
          const encoded = await fetchPolyline(positions)
          if (cancelled || !encoded) return
          drawEncoded(encoded, {
            strokeColor: "#3B82F6",
            strokeWeight: 3,
            strokeOpacity: 0.7,
          })
          await drawTravelSegments(null)
          return
        }

        const fullEncoded = await fetchPolyline(positions)
        if (cancelled || !fullEncoded) return

        if (mainMarkers.length === 2) {
          drawEncoded(fullEncoded, {
            strokeColor: "#3B82F6",
            strokeWeight: 4,
            strokeOpacity: 0.85,
          })
          await drawTravelSegments(null)
          return
        }

        drawEncoded(fullEncoded, {
          strokeColor: "#cbd5e1",
          strokeWeight: 3,
          strokeOpacity: 0.45,
        })

        const segmentPairs: [number, number][] = []
        if (activeIdx > 0) {
          segmentPairs.push([activeIdx - 1, activeIdx])
        }
        if (activeIdx < mainMarkers.length - 1) {
          segmentPairs.push([activeIdx, activeIdx + 1])
        }

        for (const [a, b] of segmentPairs) {
          if (cancelled) return
          const seg = await fetchPolyline([
            { lat: mainMarkers[a].lat, lng: mainMarkers[a].lng },
            { lat: mainMarkers[b].lat, lng: mainMarkers[b].lng },
          ])
          if (cancelled || !seg) continue
          drawEncoded(seg, {
            strokeColor: "#2563eb",
            strokeWeight: 5,
            strokeOpacity: 0.9,
          })
        }
        await drawTravelSegments(null)
      } catch {
        // Route drawing is supplementary — fail silently
      }
    }

    fetchAndDraw()

    return () => {
      cancelled = true
      for (const p of polylines) {
        p.setMap(null)
      }
    }
  }, [map, mainMarkers, travelSegments, activeActivityId, hoverMismatch])

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
  accommodationsFull,
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
        const loc = getActivityLocation(activity, accommodations, accommodationsFull)
        if (!loc) return null
        return {
          id: activity.id,
          lat: loc.lat,
          lng: loc.lng,
          index: index + 1,
          type: activity.type,
          name: getActivityName(activity, accommodationsFull),
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
  }, [displayActivities, accommodations, accommodationsFull])

  const markerPositions = useMemo(
    () => markersData.map((m) => ({ lat: m.lat, lng: m.lng })),
    [markersData]
  )

  const mainRouteMarkers = useMemo(() => {
    return displayActivities
      .filter((a) => a.type !== "travel")
      .map((activity) => {
        const loc = getActivityLocation(activity, accommodations, accommodationsFull)
        if (!loc) return null
        return { id: activity.id, lat: loc.lat, lng: loc.lng }
      })
      .filter(Boolean) as { id: string; lat: number; lng: number }[]
  }, [displayActivities, accommodations, accommodationsFull])

  const travelSegments = useMemo(() => {
    return displayActivities
      .filter(
        (a) =>
          a.type === "travel" &&
          a.travelLeg?.resolvedOrigin &&
          a.travelLeg?.resolvedDestination
      )
      .map((a) => ({
        activityId: a.id,
        from: {
          lat: a.travelLeg!.resolvedOrigin!.lat,
          lng: a.travelLeg!.resolvedOrigin!.lng,
        },
        to: {
          lat: a.travelLeg!.resolvedDestination!.lat,
          lng: a.travelLeg!.resolvedDestination!.lng,
        },
      }))
  }, [displayActivities])

  const boundsMarkerPositions = useMemo(() => {
    const pts: { lat: number; lng: number }[] = markerPositions.map((p) => ({
      ...p,
    }))
    for (const s of travelSegments) {
      pts.push(s.from, s.to)
    }
    return pts
  }, [markerPositions, travelSegments])

  const hoverMismatch = useMemo(
    () =>
      activeActivityId != null &&
      !markersData.some((m) => m.id === activeActivityId),
    [activeActivityId, markersData]
  )

  const handleMarkerClick = useCallback(
    (markerId: string) => {
      setSelectedMarkerId((prev) => (prev === markerId ? null : markerId))
      onMarkerClick(markerId)
    },
    [onMarkerClick]
  )

  useEffect(() => {
    setSelectedMarkerId(activeActivityId)
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
            <MapBoundsHandler markers={boundsMarkerPositions} />
            {(mainRouteMarkers.length >= 2 || travelSegments.length > 0) && (
              <RoutePolylineRenderer
                mainMarkers={mainRouteMarkers}
                travelSegments={travelSegments}
                activeActivityId={activeActivityId}
                hoverMismatch={hoverMismatch}
              />
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
