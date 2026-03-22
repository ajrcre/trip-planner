# Itinerary Details & Interactive Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add collapsible place details to itinerary activity cards, lodging as a first-class activity type with auto-insertion, and an interactive Google Map showing locations and routes alongside the timeline.

**Architecture:** Expand the ActivityData interface to include full attraction/restaurant fields. Add a new `ItineraryMap` component using `@vis.gl/react-google-maps` in a split-panel layout (RTL: map left, timeline right). Lodging activities use the existing `type` field with value `"lodging"` and derive data from trip accommodations.

**Tech Stack:** Next.js, React, Tailwind CSS, `@vis.gl/react-google-maps`, Google Maps JavaScript API (Directions Service), Prisma

---

### Task 1: Expand ActivityData interface and API response

**Files:**
- Modify: `src/components/schedule/ActivityCard.tsx:5-18` (ActivityData interface)
- Modify: `src/app/api/trips/[tripId]/schedule/route.ts:43-53` (GET handler includes)

**Step 1: Update the ActivityData interface**

In `src/components/schedule/ActivityCard.tsx`, expand the attraction/restaurant types in the ActivityData interface:

```typescript
export interface ActivityData {
  id: string
  sortOrder: number
  timeStart: string | null
  timeEnd: string | null
  type: string
  notes: string | null
  attractionId: string | null
  restaurantId: string | null
  travelTimeToNextMinutes: number | null
  attraction: {
    id: string
    name: string
    address: string | null
    phone: string | null
    website: string | null
    googlePlaceId: string | null
    openingHours: unknown
    lat: number | null
    lng: number | null
  } | null
  restaurant: {
    id: string
    name: string
    address: string | null
    phone: string | null
    website: string | null
    googlePlaceId: string | null
    openingHours: unknown
    lat: number | null
    lng: number | null
  } | null
  drivingTimesFromLodging?: { accommodationName: string; minutes: number }[]
}
```

**Step 2: Verify the schedule API already returns full objects**

The GET handler at `src/app/api/trips/[tripId]/schedule/route.ts:46-48` already uses `attraction: true, restaurant: true` in the Prisma include, which returns all fields. The client was simply ignoring extra fields. No API change needed.

**Step 3: Verify the app builds**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/schedule/ActivityCard.tsx
git commit -m "feat: expand ActivityData interface with place detail fields"
```

---

### Task 2: Add collapsible details section to ActivityCard

**Files:**
- Modify: `src/components/schedule/ActivityCard.tsx`

**Step 1: Add expanded state and helper functions**

Add to the component after existing useState declarations (around line 43):

```typescript
const [isExpanded, setIsExpanded] = useState(false)

const place = activity.attraction ?? activity.restaurant
const hasDetails = place && (place.address || place.phone || place.website || place.openingHours)
```

Add a helper function to parse today's opening hours from the openingHours JSON (which is an array of weekday strings like `["Monday: 9:00 AM – 6:00 PM", ...]`):

```typescript
function getTodayHours(openingHours: unknown): { todayText: string; allDays: string[] } | null {
  if (!openingHours || !Array.isArray(openingHours)) return null
  const days = openingHours as string[]
  if (days.length === 0) return null
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" })
  const todayEntry = days.find((d) => d.startsWith(today))
  return {
    todayText: todayEntry ?? days[0],
    allDays: days,
  }
}
```

Add a helper to detect time conflicts:

```typescript
function getTimeConflict(
  timeStart: string | null,
  timeEnd: string | null,
  openingHours: unknown
): string | null {
  const hours = getTodayHours(openingHours)
  if (!hours || !timeStart) return null
  // Parse opening/closing from "Monday: 9:00 AM – 6:00 PM" format
  const match = hours.todayText.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*[–-]\s*(\d{1,2}:\d{2}\s*[AP]M)/i)
  if (!match) return null
  const openTime = to24h(match[1].trim())
  const closeTime = to24h(match[2].trim())
  if (openTime && timeStart < openTime) {
    return `נפתח ב-${match[1].trim()} — אתם מגיעים ב-${timeStart}`
  }
  if (closeTime && timeEnd && timeEnd > closeTime) {
    return `נסגר ב-${match[2].trim()} — אתם עד ${timeEnd}`
  }
  return null
}

function to24h(time12: string): string | null {
  const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return null
  let h = parseInt(match[1])
  const m = match[2]
  const period = match[3].toUpperCase()
  if (period === "PM" && h !== 12) h += 12
  if (period === "AM" && h === 12) h = 0
  return `${h.toString().padStart(2, "0")}:${m}`
}
```

**Step 2: Add the expandable details UI**

In the non-editing view (after the notes section, around line 179), add the collapsible details:

```tsx
{/* Expandable details toggle */}
{hasDetails && (
  <button
    onClick={() => setIsExpanded(!isExpanded)}
    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
  >
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
    {isExpanded ? "הסתר פרטים" : "הצג פרטים"}
  </button>
)}

{/* Expanded details */}
{isExpanded && place && (
  <div className="mt-2 flex flex-col gap-1.5 rounded-md bg-zinc-50 p-2.5 text-xs dark:bg-zinc-900/50">
    {/* Time conflict warning */}
    {(() => {
      const conflict = getTimeConflict(activity.timeStart, activity.timeEnd, place.openingHours)
      if (!conflict) return null
      return (
        <div className="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <span>⚠️</span>
          <span>{conflict}</span>
        </div>
      )
    })()}

    {place.address && (
      <div className="flex items-start gap-1.5">
        <span className="text-zinc-400">📍</span>
        <span>{place.address}</span>
      </div>
    )}

    {place.phone && (
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-400">📞</span>
        <a href={`tel:${place.phone}`} className="text-blue-500 hover:underline">
          {place.phone}
        </a>
      </div>
    )}

    {place.website && (
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-400">🌐</span>
        <a
          href={place.website}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-blue-500 hover:underline"
        >
          {new URL(place.website).hostname}
        </a>
      </div>
    )}

    {place.googlePlaceId && (
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-400">🗺️</span>
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          הצג בגוגל מפות
        </a>
      </div>
    )}

    {/* Opening hours */}
    {(() => {
      const hours = getTodayHours(place.openingHours)
      if (!hours) return null
      return <OpeningHoursSection hours={hours} />
    })()}
  </div>
)}
```

**Step 3: Create the OpeningHoursSection sub-component**

Add above the main component in the same file:

```tsx
function OpeningHoursSection({ hours }: { hours: { todayText: string; allDays: string[] } }) {
  const [showAll, setShowAll] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-400">🕐</span>
        <span className="font-medium">{hours.todayText}</span>
      </div>
      {hours.allDays.length > 1 && (
        <>
          <button
            onClick={() => setShowAll(!showAll)}
            className="mr-5 text-start text-blue-500 hover:underline"
          >
            {showAll ? "הסתר שעות פתיחה" : "כל שעות הפתיחה"}
          </button>
          {showAll && (
            <div className="mr-5 flex flex-col gap-0.5 text-zinc-500 dark:text-zinc-400">
              {hours.allDays.map((day, i) => (
                <span key={i}>{day}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

**Step 4: Verify the app builds**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/components/schedule/ActivityCard.tsx
git commit -m "feat: add collapsible place details with opening hours and time conflict warnings"
```

---

### Task 3: Add lodging activity type

**Files:**
- Modify: `src/components/schedule/ActivityCard.tsx:20-30` (typeConfig)
- Modify: `src/components/schedule/DayTimeline.tsx:33-39` (activityTypes)

**Step 1: Add lodging to typeConfig in ActivityCard**

Add to the `typeConfig` object in `ActivityCard.tsx`:

```typescript
lodging: { icon: "🏨", label: "לינה" },
```

**Step 2: Add lodging to activityTypes in DayTimeline**

Add to the `activityTypes` array in `DayTimeline.tsx`:

```typescript
{ value: "lodging", label: "לינה" },
```

**Step 3: Handle lodging selection in DayTimeline add form**

When the user selects "lodging" as activity type, auto-fill notes with the accommodation name. This requires passing accommodation data to DayTimeline.

Update `DayTimelineProps` to include accommodations:

```typescript
interface DayTimelineProps {
  tripId: string
  dayPlan: DayPlanData
  attractions: AttractionOption[]
  restaurants: RestaurantOption[]
  accommodations: { name: string; address?: string; lat?: number; lng?: number }[]
  onUpdate: () => void
}
```

In the add dialog, when type is "lodging", show an accommodation selector (similar to attraction/restaurant dropdowns) that auto-fills the notes field.

**Step 4: Pass accommodations from ScheduleView to DayTimeline**

In `ScheduleView.tsx`, compute accommodations for the active day and pass them:

```tsx
const activeDayAccommodations = activePlan
  ? getAccommodationsForDay(accommodations, normalizeDate(activePlan.date))
      .map(({ accommodation }) => ({
        name: accommodation.name ?? "לינה",
        address: accommodation.address,
        lat: accommodation.coordinates?.lat,
        lng: accommodation.coordinates?.lng,
      }))
  : []
```

Pass `accommodations={activeDayAccommodations}` to `<DayTimeline>`.

**Step 5: Verify the app builds**

Run: `npm run build`

**Step 6: Commit**

```bash
git add src/components/schedule/ActivityCard.tsx src/components/schedule/DayTimeline.tsx src/components/schedule/ScheduleView.tsx
git commit -m "feat: add lodging as activity type with accommodation selector"
```

---

### Task 4: Auto-insert lodging activities on schedule generation

**Files:**
- Modify: `src/app/api/trips/[tripId]/schedule/route.ts:81-168` (POST handler)

**Step 1: After creating day plans, auto-insert lodging activities**

In the POST handler, after `syncLogisticsActivities` and before the final fetch, insert lodging activities for each day:

```typescript
// Auto-insert lodging activities at start/end of each day
const accommodationData = normalizeAccommodations(trip.accommodation)
const createdDayPlans = await prisma.dayPlan.findMany({
  where: { tripId },
  orderBy: { date: "asc" },
})

for (const dayPlan of createdDayPlans) {
  const dayDate = dayPlan.date.toISOString().split("T")[0]
  const dayAccs = getAccommodationsForDay(accommodationData, dayDate)

  if (dayAccs.length === 0) continue

  const acc = dayAccs[0].accommodation
  const accName = acc.name ?? "לינה"
  const lodgingActivities: { sortOrder: number; type: string; timeStart: string; timeEnd: string | null; notes: string }[] = []

  if (dayPlan.dayType === "arrival") {
    // End of arrival day: lodging check-in
    lodgingActivities.push({
      sortOrder: 900,
      type: "lodging",
      timeStart: "21:00",
      timeEnd: null,
      notes: accName,
    })
  } else if (dayPlan.dayType === "departure") {
    // Start of departure day: lodging check-out
    lodgingActivities.push({
      sortOrder: 0,
      type: "lodging",
      timeStart: "09:00",
      timeEnd: null,
      notes: accName,
    })
  } else {
    // Full day: lodging at start and end
    lodgingActivities.push(
      {
        sortOrder: 0,
        type: "lodging",
        timeStart: "09:00",
        timeEnd: null,
        notes: accName,
      },
      {
        sortOrder: 900,
        type: "lodging",
        timeStart: "21:00",
        timeEnd: null,
        notes: accName,
      }
    )
  }

  for (const la of lodgingActivities) {
    await prisma.activity.create({
      data: {
        dayPlanId: dayPlan.id,
        ...la,
      },
    })
  }
}
```

**Step 2: Verify the app builds**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/trips/[tripId]/schedule/route.ts
git commit -m "feat: auto-insert lodging activities when generating schedule"
```

---

### Task 5: Install @vis.gl/react-google-maps

**Step 1: Install the package**

Run: `npm install @vis.gl/react-google-maps`

**Step 2: Verify it installs correctly**

Run: `npm run build`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @vis.gl/react-google-maps dependency"
```

---

### Task 6: Create ItineraryMap component

**Files:**
- Create: `src/components/schedule/ItineraryMap.tsx`

**Step 1: Create the ItineraryMap component**

```tsx
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from "@vis.gl/react-google-maps"
import type { ActivityData } from "./ActivityCard"

interface ItineraryMapProps {
  activities: ActivityData[]
  allDayPlans?: { id: string; date: string; activities: ActivityData[] }[]
  activeActivityId: string | null
  onMarkerClick: (activityId: string) => void
  accommodations: { name: string; lat?: number; lng?: number }[]
}

const markerColors: Record<string, string> = {
  lodging: "#3B82F6",    // blue
  attraction: "#F97316",  // orange
  meal: "#EF4444",       // red
  travel: "#8B5CF6",     // purple
  rest: "#6B7280",       // gray
  custom: "#10B981",     // green
  flight_departure: "#0EA5E9",
  flight_arrival: "#0EA5E9",
  car_pickup: "#F59E0B",
  car_return: "#F59E0B",
}

function getActivityLocation(activity: ActivityData, accommodations: { name: string; lat?: number; lng?: number }[]): { lat: number; lng: number } | null {
  if (activity.attraction?.lat && activity.attraction?.lng) {
    return { lat: activity.attraction.lat, lng: activity.attraction.lng }
  }
  if (activity.restaurant?.lat && activity.restaurant?.lng) {
    return { lat: activity.restaurant.lat, lng: activity.restaurant.lng }
  }
  if (activity.type === "lodging") {
    // Match accommodation by name in notes
    const acc = accommodations.find(a => a.name === activity.notes)
    if (acc?.lat && acc?.lng) return { lat: acc.lat, lng: acc.lng }
    // Fallback to first accommodation with coords
    const fallback = accommodations.find(a => a.lat && a.lng)
    if (fallback?.lat && fallback?.lng) return { lat: fallback.lat, lng: fallback.lng }
  }
  return null
}

export function ItineraryMap({
  activities,
  allDayPlans,
  activeActivityId,
  onMarkerClick,
  accommodations,
}: ItineraryMapProps) {
  const [showAllDays, setShowAllDays] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

  // Build markers from activities
  const markers = useMemo(() => {
    const source = showAllDays && allDayPlans
      ? allDayPlans.flatMap(dp => dp.activities)
      : activities

    return source
      .map((a, index) => {
        const loc = getActivityLocation(a, accommodations)
        if (!loc) return null
        return {
          id: a.id,
          position: loc,
          index: index + 1,
          type: a.type,
          name: a.attraction?.name ?? a.restaurant?.name ?? a.notes ?? "",
          time: a.timeStart ?? "",
          color: markerColors[a.type] ?? markerColors.custom,
        }
      })
      .filter(Boolean) as Array<{
        id: string
        position: { lat: number; lng: number }
        index: number
        type: string
        name: string
        time: string
        color: string
      }>
  }, [activities, allDayPlans, showAllDays, accommodations])

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
      >
        🗺️ הצג מפה
      </button>
    )
  }

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
      {/* Map toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">🗺️ מפה</span>
          <button
            onClick={() => setShowAllDays(!showAllDays)}
            className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
              showAllDays
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
            }`}
          >
            {showAllDays ? "כל הימים" : "יום נוכחי"}
          </button>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          title="מזער מפה"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Map */}
      <div className="h-[400px] lg:h-full min-h-[300px]">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultZoom={12}
            defaultCenter={markers[0]?.position ?? { lat: 0, lng: 0 }}
            mapId="itinerary-map"
            gestureHandling="greedy"
            className="h-full w-full"
          >
            <MapBoundsHandler markers={markers} />
            {markers.map((marker) => (
              <AdvancedMarker
                key={marker.id}
                position={marker.position}
                onClick={() => {
                  setSelectedMarker(marker.id)
                  onMarkerClick(marker.id)
                }}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-md transition-transform ${
                    activeActivityId === marker.id ? "scale-125 ring-2 ring-white" : ""
                  }`}
                  style={{ backgroundColor: marker.color }}
                >
                  {marker.index}
                </div>
              </AdvancedMarker>
            ))}

            {selectedMarker && (() => {
              const m = markers.find(mk => mk.id === selectedMarker)
              if (!m) return null
              return (
                <InfoWindow
                  position={m.position}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="p-1 text-sm" dir="rtl">
                    <div className="font-medium">{m.name}</div>
                    {m.time && <div className="text-zinc-500">{m.time}</div>}
                  </div>
                </InfoWindow>
              )
            })()}

            <DirectionsRenderer markers={markers} />
          </Map>
        </APIProvider>
      </div>
    </div>
  )
}

/** Auto-fit map bounds to markers */
function MapBoundsHandler({ markers }: { markers: { position: { lat: number; lng: number } }[] }) {
  const map = useMap()

  useEffect(() => {
    if (!map || markers.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    markers.forEach(m => bounds.extend(m.position))
    map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 })
  }, [map, markers])

  return null
}

/** Render driving directions between consecutive markers */
function DirectionsRenderer({ markers }: { markers: { position: { lat: number; lng: number } }[] }) {
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

    const origin = markers[0].position
    const destination = markers[markers.length - 1].position
    const waypoints = markers.slice(1, -1).map(m => ({
      location: m.position,
      stopover: true,
    }))

    directionsService.route(
      {
        origin,
        destination,
        waypoints,
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
```

**Step 2: Verify the app builds**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/schedule/ItineraryMap.tsx
git commit -m "feat: create ItineraryMap component with markers, routes, and info windows"
```

---

### Task 7: Integrate ItineraryMap into ScheduleView with split-panel layout

**Files:**
- Modify: `src/components/schedule/ScheduleView.tsx`

**Step 1: Import the ItineraryMap**

```typescript
import { ItineraryMap } from "./ItineraryMap"
```

**Step 2: Add state for active activity and map interaction**

Add after existing state declarations:

```typescript
const [activeActivityId, setActiveActivityId] = useState<string | null>(null)
```

**Step 3: Create the bidirectional interaction handler**

```typescript
const handleMarkerClick = useCallback((activityId: string) => {
  setActiveActivityId(activityId)
  // Scroll to activity in timeline
  const el = document.getElementById(`activity-${activityId}`)
  el?.scrollIntoView({ behavior: "smooth", block: "center" })
}, [])
```

**Step 4: Compute accommodations for map**

After the existing `activeDayAccommodations` computation (from Task 3), reuse the same data for the map.

**Step 5: Restructure the return JSX to split-panel layout (RTL)**

Replace the main return content (lines 194-259) with:

```tsx
return (
  <div className="flex flex-col gap-4">
    {/* Day tabs - full width */}
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
      {/* ... existing day tab buttons unchanged ... */}
    </div>

    {/* Split panel: map (left) + timeline (right) for RTL */}
    <div className="flex flex-col gap-4 lg:flex-row-reverse">
      {/* Timeline panel */}
      <div className="flex flex-1 flex-col gap-4 lg:max-w-[55%]">
        {/* Weather */}
        {activePlan && (
          <WeatherForecast
            dailyWeather={weatherByDate.get(normalizeDate(activePlan.date)) ?? null}
            hourlyWeather={hourlyByDate.get(normalizeDate(activePlan.date)) ?? null}
            isNearDate={isWithinTwoWeeks(activePlan.date)}
            isLoading={isWeatherLoading}
          />
        )}

        {/* Day timeline */}
        {activePlan && (
          <DayTimeline
            tripId={trip.id}
            dayPlan={activePlan}
            attractions={trip.attractions}
            restaurants={trip.restaurants}
            accommodations={activeDayAccommodations}
            onUpdate={fetchSchedule}
            activeActivityId={activeActivityId}
            onActivityHover={setActiveActivityId}
          />
        )}

        {/* AI Assistant */}
        <AiAssistant tripId={trip.id} />
      </div>

      {/* Map panel */}
      <div className="lg:sticky lg:top-4 lg:max-w-[45%] lg:flex-1 lg:self-start">
        {activePlan && (
          <ItineraryMap
            activities={activePlan.activities}
            allDayPlans={dayPlans.map(dp => ({
              id: dp.id,
              date: dp.date,
              activities: dp.activities,
            }))}
            activeActivityId={activeActivityId}
            onMarkerClick={handleMarkerClick}
            accommodations={activeDayAccommodations}
          />
        )}
      </div>
    </div>
  </div>
)
```

**Step 6: Add activity IDs to DayTimeline rendering**

In `DayTimeline.tsx`, add `id={`activity-${activity.id}`}` to each activity wrapper div for scroll-to-activity support. Also accept and pass through `activeActivityId` and `onActivityHover` props.

Update DayTimelineProps:

```typescript
interface DayTimelineProps {
  tripId: string
  dayPlan: DayPlanData
  attractions: AttractionOption[]
  restaurants: RestaurantOption[]
  accommodations: { name: string; address?: string; lat?: number; lng?: number }[]
  onUpdate: () => void
  activeActivityId?: string | null
  onActivityHover?: (activityId: string | null) => void
}
```

Wrap each ActivityCard's container div with:

```tsx
<div
  key={activity.id}
  id={`activity-${activity.id}`}
  className={`flex flex-col gap-2 transition-all ${
    activeActivityId === activity.id ? "ring-2 ring-blue-400 rounded-lg" : ""
  }`}
  onMouseEnter={() => onActivityHover?.(activity.id)}
  onMouseLeave={() => onActivityHover?.(null)}
>
```

**Step 7: Verify the app builds**

Run: `npm run build`

**Step 8: Commit**

```bash
git add src/components/schedule/ScheduleView.tsx src/components/schedule/DayTimeline.tsx
git commit -m "feat: integrate ItineraryMap in RTL split-panel layout with bidirectional interaction"
```

---

### Task 8: Expose NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

**Files:**
- Modify: `.env.example`

**Step 1: Add the env var to .env.example**

Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=` to `.env.example`. The actual value should be set in `.env.local` — it should be the same Google API key already in use, but exposed to the browser via the `NEXT_PUBLIC_` prefix.

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to env example"
```

---

### Task 9: End-to-end verification

**Step 1: Run the dev server**

Run: `npm run dev`

**Step 2: Verify manually**

- Navigate to a trip's schedule tab
- Verify activity cards show expandable chevron for attractions/restaurants
- Expand details and check address, phone, website, Google Maps link, opening hours
- Verify time conflict warnings appear when applicable
- Check that lodging activities appear at start/end of days
- Verify the map shows numbered markers for activities
- Click a marker — verify info window and timeline highlight
- Hover an activity — verify marker highlight on map
- Toggle "All days" on the map
- Collapse/expand the map
- Test on mobile viewport (map below timeline)

**Step 3: Run build**

Run: `npm run build`

**Step 4: Final commit if any fixes needed**
