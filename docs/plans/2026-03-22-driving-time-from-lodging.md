# Driving Time from Lodging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show driving time from the day's accommodation(s) to each activity location on the itinerary. When a day has two accommodations (check-out + check-in, i.e., travel day), show both driving times.

**Architecture:** Compute driving times server-side when the schedule is fetched (GET `/api/trips/[tripId]/schedule`). The API enriches each activity with `drivingTimesFromLodging` — an array of `{ accommodationName, minutes }` computed from accommodation coordinates → activity's attraction/restaurant coordinates. This avoids new DB columns; the data is computed on-read since it depends on which accommodations apply to each day. The frontend displays it as a subtle badge on each ActivityCard.

**Tech Stack:** Next.js API routes, Prisma, Google Maps Routes API (`calculateRoute`), React/Tailwind

---

### Task 1: Create the driving-time computation utility

**Files:**
- Create: `src/lib/driving-times.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/driving-times.test.ts`:

```typescript
import { computeDrivingTimesForDay } from "../driving-times"

// Mock google-maps
jest.mock("../google-maps", () => ({
  calculateRoute: jest.fn(),
}))

import { calculateRoute } from "../google-maps"

const mockedCalculateRoute = calculateRoute as jest.MockedFunction<typeof calculateRoute>

describe("computeDrivingTimesForDay", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns empty array when activity has no coordinates", async () => {
    const accommodations = [
      { name: "Hotel A", coordinates: { lat: 1, lng: 2 } },
    ]
    const activity = {
      attraction: null,
      restaurant: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([])
    expect(mockedCalculateRoute).not.toHaveBeenCalled()
  })

  it("returns empty array when no accommodations have coordinates", async () => {
    const accommodations = [{ name: "Hotel A" }]
    const activity = {
      attraction: { lat: 3, lng: 4 },
      restaurant: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([])
  })

  it("returns driving time from one accommodation to attraction", async () => {
    mockedCalculateRoute.mockResolvedValue({ durationMinutes: 25, distanceKm: 18.5 })

    const accommodations = [
      { name: "Hotel A", coordinates: { lat: 1, lng: 2 } },
    ]
    const activity = {
      attraction: { lat: 3, lng: 4 },
      restaurant: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([
      { accommodationName: "Hotel A", minutes: 25 },
    ])
    expect(mockedCalculateRoute).toHaveBeenCalledWith({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })
  })

  it("returns driving time from accommodation to restaurant", async () => {
    mockedCalculateRoute.mockResolvedValue({ durationMinutes: 10, distanceKm: 5.0 })

    const accommodations = [
      { name: "Hotel B", coordinates: { lat: 5, lng: 6 } },
    ]
    const activity = {
      attraction: null,
      restaurant: { lat: 7, lng: 8 },
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([
      { accommodationName: "Hotel B", minutes: 10 },
    ])
  })

  it("returns two driving times when day has two accommodations (travel day)", async () => {
    mockedCalculateRoute
      .mockResolvedValueOnce({ durationMinutes: 30, distanceKm: 20 })
      .mockResolvedValueOnce({ durationMinutes: 15, distanceKm: 10 })

    const accommodations = [
      { name: "Hotel Checkout", coordinates: { lat: 1, lng: 2 } },
      { name: "Hotel Checkin", coordinates: { lat: 5, lng: 6 } },
    ]
    const activity = {
      attraction: { lat: 3, lng: 4 },
      restaurant: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([
      { accommodationName: "Hotel Checkout", minutes: 30 },
      { accommodationName: "Hotel Checkin", minutes: 15 },
    ])
  })

  it("prefers attraction coordinates over restaurant when both exist", async () => {
    mockedCalculateRoute.mockResolvedValue({ durationMinutes: 20, distanceKm: 12 })

    const accommodations = [
      { name: "Hotel", coordinates: { lat: 1, lng: 2 } },
    ]
    const activity = {
      attraction: { lat: 3, lng: 4 },
      restaurant: { lat: 5, lng: 6 },
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([
      { accommodationName: "Hotel", minutes: 20 },
    ])
    expect(mockedCalculateRoute).toHaveBeenCalledWith({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })
  })

  it("handles calculateRoute failure gracefully — skips that pair", async () => {
    mockedCalculateRoute.mockRejectedValue(new Error("API error"))

    const accommodations = [
      { name: "Hotel A", coordinates: { lat: 1, lng: 2 } },
    ]
    const activity = {
      attraction: { lat: 3, lng: 4 },
      restaurant: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/driving-times.test.ts --no-cache`
Expected: FAIL — module `../driving-times` not found

**Step 3: Write minimal implementation**

Create `src/lib/driving-times.ts`:

```typescript
import { calculateRoute } from "./google-maps"

interface AccommodationForDriving {
  name?: string
  coordinates?: { lat: number; lng: number }
}

interface ActivityForDriving {
  attraction: { lat: number | null; lng: number | null } | null
  restaurant: { lat: number | null; lng: number | null } | null
}

export interface DrivingTimeFromLodging {
  accommodationName: string
  minutes: number
}

/**
 * Compute driving times from each accommodation to an activity's location.
 * Returns one entry per accommodation that has coordinates.
 * Prefers attraction coords; falls back to restaurant coords.
 */
export async function computeDrivingTimesForDay(
  accommodations: AccommodationForDriving[],
  activity: ActivityForDriving
): Promise<DrivingTimeFromLodging[]> {
  // Determine activity destination coordinates
  const destLat = activity.attraction?.lat ?? activity.restaurant?.lat ?? null
  const destLng = activity.attraction?.lng ?? activity.restaurant?.lng ?? null

  if (destLat == null || destLng == null) return []

  const dest = { lat: destLat, lng: destLng }

  // Filter accommodations with coordinates
  const accsWithCoords = accommodations.filter(
    (a): a is AccommodationForDriving & { coordinates: { lat: number; lng: number } } =>
      a.coordinates != null
  )

  if (accsWithCoords.length === 0) return []

  const results: DrivingTimeFromLodging[] = []

  for (const acc of accsWithCoords) {
    try {
      const route = await calculateRoute(acc.coordinates, dest)
      results.push({
        accommodationName: acc.name || "לינה",
        minutes: route.durationMinutes,
      })
    } catch {
      // Skip this accommodation if route calculation fails
    }
  }

  return results
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/driving-times.test.ts --no-cache`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/lib/driving-times.ts src/lib/__tests__/driving-times.test.ts
git commit -m "feat: add driving-time-from-lodging computation utility"
```

---

### Task 2: Enrich schedule GET response with driving times

**Files:**
- Modify: `src/app/api/trips/[tripId]/schedule/route.ts` (GET handler)

**Step 1: Write the enrichment logic**

In `src/app/api/trips/[tripId]/schedule/route.ts`, modify the GET handler to:
1. Load accommodations from the trip
2. For each day, determine which accommodations apply (using `getAccommodationsForDay`)
3. For each activity, compute driving times from those accommodations
4. Append `drivingTimesFromLodging` to each activity in the response

Replace the GET handler:

```typescript
import { normalizeAccommodations, getAccommodationsForDay } from "@/lib/accommodations"
import { computeDrivingTimesForDay, type DrivingTimeFromLodging } from "@/lib/driving-times"

// ... (keep existing verifyTripAccess)

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const trip = await verifyTripAccess(tripId, session.user.id)
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const dayPlans = await prisma.dayPlan.findMany({
    where: { tripId },
    include: {
      activities: {
        include: {
          attraction: true,
          restaurant: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { date: "asc" },
  })

  // Enrich with driving times from accommodations
  const accommodations = normalizeAccommodations(trip.accommodation)

  const enrichedPlans = await Promise.all(
    dayPlans.map(async (dayPlan) => {
      const dayDate = dayPlan.date.toISOString().split("T")[0]
      const dayAccs = getAccommodationsForDay(accommodations, dayDate)

      // Extract just the accommodation objects for driving time computation
      const accsForDriving = dayAccs.map((da) => da.accommodation)

      const enrichedActivities = await Promise.all(
        dayPlan.activities.map(async (activity) => {
          let drivingTimesFromLodging: DrivingTimeFromLodging[] = []

          // Only compute for activities with location-based entities
          if (activity.attraction || activity.restaurant) {
            drivingTimesFromLodging = await computeDrivingTimesForDay(
              accsForDriving,
              activity
            )
          }

          return {
            ...activity,
            drivingTimesFromLodging,
          }
        })
      )

      return {
        ...dayPlan,
        activities: enrichedActivities,
      }
    })
  )

  return NextResponse.json(enrichedPlans)
}
```

**Step 2: Test manually**

Run: `npm run dev`
Visit a trip's schedule page. Open browser DevTools → Network tab. Inspect the `/api/trips/.../schedule` response. Each activity should now have a `drivingTimesFromLodging` array.

**Step 3: Commit**

```bash
git add src/app/api/trips/[tripId]/schedule/route.ts
git commit -m "feat: enrich schedule API with driving times from lodging"
```

---

### Task 3: Update ActivityData interface and ActivityCard UI

**Files:**
- Modify: `src/components/schedule/ActivityCard.tsx`

**Step 1: Add `drivingTimesFromLodging` to the ActivityData interface**

In `ActivityCard.tsx`, add to the `ActivityData` interface:

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
  attraction: { id: string; name: string } | null
  restaurant: { id: string; name: string } | null
  drivingTimesFromLodging?: { accommodationName: string; minutes: number }[]
}
```

**Step 2: Add driving time badge to the ActivityCard display**

In the view mode section of ActivityCard (inside the `<div className="flex flex-1 flex-col gap-1">` block), add below the time display and above the notes:

```tsx
{/* Driving time from lodging */}
{activity.drivingTimesFromLodging &&
  activity.drivingTimesFromLodging.length > 0 && (
    <div className="flex flex-wrap gap-1.5">
      {activity.drivingTimesFromLodging.map((dt, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          title={`נסיעה מ${dt.accommodationName}`}
        >
          🏨→🚗 {dt.minutes} דק׳
          {activity.drivingTimesFromLodging!.length > 1 && (
            <span className="text-blue-400 dark:text-blue-500">
              ({dt.accommodationName})
            </span>
          )}
        </span>
      ))}
    </div>
  )}
```

The logic:
- If there's only 1 accommodation for the day: show `🏨→🚗 25 דק׳`
- If there are 2 accommodations (travel day): show `🏨→🚗 25 דק׳ (Hotel Checkout)` and `🏨→🚗 15 דק׳ (Hotel Checkin)` — both with the accommodation name to distinguish them

**Step 3: Run dev server and verify visually**

Run: `npm run dev`
Open a trip with accommodations and activities that have attractions/restaurants. Verify:
- Activities with locations show the blue driving time badge(s)
- On travel days (check-out + check-in), two badges appear
- Activities without locations (rest, custom) show no badge
- The badge looks good in both light and dark mode

**Step 4: Commit**

```bash
git add src/components/schedule/ActivityCard.tsx
git commit -m "feat: display driving time from lodging on activity cards"
```

---

### Task 4: Add caching to avoid redundant API calls

**Files:**
- Modify: `src/lib/driving-times.ts`

The Google Maps Routes API is called per accommodation-activity pair on every schedule load. To avoid repeated calls for the same origin-destination, add a simple in-memory cache with TTL.

**Step 1: Add cache logic to driving-times.ts**

Add at the top of `driving-times.ts`:

```typescript
// Simple in-memory cache for route calculations (server-side, per-request lifecycle in serverless)
// Key: "lat1,lng1→lat2,lng2", Value: { minutes, timestamp }
const routeCache = new Map<string, { minutes: number; timestamp: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function getCacheKey(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): string {
  return `${origin.lat},${origin.lng}→${dest.lat},${dest.lng}`
}

async function getRouteMinutes(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): Promise<number> {
  const key = getCacheKey(origin, dest)
  const cached = routeCache.get(key)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.minutes
  }

  const route = await calculateRoute(origin, dest)
  routeCache.set(key, { minutes: route.durationMinutes, timestamp: Date.now() })
  return route.durationMinutes
}
```

Then replace the `calculateRoute` call inside `computeDrivingTimesForDay` with `getRouteMinutes`:

```typescript
const minutes = await getRouteMinutes(acc.coordinates, dest)
results.push({
  accommodationName: acc.name || "לינה",
  minutes,
})
```

**Step 2: Update tests for cache behavior**

Add to the test file:

```typescript
it("caches route results for same origin-destination", async () => {
  mockedCalculateRoute.mockResolvedValue({ durationMinutes: 25, distanceKm: 18.5 })

  const accommodations = [{ name: "Hotel A", coordinates: { lat: 1, lng: 2 } }]
  const activity = { attraction: { lat: 3, lng: 4 }, restaurant: null }

  // Call twice
  await computeDrivingTimesForDay(accommodations, activity)
  await computeDrivingTimesForDay(accommodations, activity)

  // calculateRoute should only be called once due to cache
  expect(mockedCalculateRoute).toHaveBeenCalledTimes(1)
})
```

**Step 3: Run tests**

Run: `npx jest src/lib/__tests__/driving-times.test.ts --no-cache`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/lib/driving-times.ts src/lib/__tests__/driving-times.test.ts
git commit -m "feat: add in-memory cache for driving time calculations"
```

---

### Task 5: Visual polish and edge cases

**Files:**
- Modify: `src/components/schedule/ActivityCard.tsx`

**Step 1: Handle edge cases in the UI**

- Skip rendering for activity types that don't represent a place (`travel`, `rest`, `flight_departure`, `flight_arrival`, `car_pickup`, `car_return`)
- These types are logistical, not location visits

Update the driving time badge conditional:

```tsx
{/* Driving time from lodging — only for place-based activities */}
{activity.drivingTimesFromLodging &&
  activity.drivingTimesFromLodging.length > 0 &&
  !["travel", "rest", "flight_departure", "flight_arrival", "car_pickup", "car_return"].includes(activity.type) && (
    <div className="flex flex-wrap gap-1.5">
      {activity.drivingTimesFromLodging.map((dt, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          title={`נסיעה מ${dt.accommodationName}`}
        >
          🏨→🚗 {dt.minutes} דק׳
          {activity.drivingTimesFromLodging!.length > 1 && (
            <span className="text-blue-400 dark:text-blue-500">
              ({dt.accommodationName})
            </span>
          )}
        </span>
      ))}
    </div>
  )}
```

**Step 2: Test visually**

Run: `npm run dev`
Verify:
- Logistics activities (flights, car pickup/return) do NOT show driving badges
- Attractions and meals show driving badges
- Travel days with 2 accommodations show 2 badges per activity

**Step 3: Commit**

```bash
git add src/components/schedule/ActivityCard.tsx
git commit -m "fix: hide driving time badges for logistical activity types"
```

---

### Task 6: Run full build and tests

**Step 1: Run the test suite**

Run: `npx jest --no-cache`
Expected: All tests PASS

**Step 2: Run the build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Fix any issues found**

If type errors or test failures, fix them before proceeding.

**Step 4: Final commit if needed**

```bash
git add -A
git commit -m "chore: fix build/test issues for driving time feature"
```
