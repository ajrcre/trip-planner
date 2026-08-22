# Time-Aware Travel Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two travel-time surfaces in the schedule reflect traffic at the time of day the user will actually be travelling, in the destination's local time, and refresh when an activity is edited.

**Architecture:** `calculateRoute` gains an optional `departureTime` that is sent to the Google Routes API only when it is safely in the future. A new `trip-timezone.ts` module resolves the destination's IANA timezone from route-origin coordinates (cached, ~one call per city) and converts a day's date plus an activity's `HH:mm` start into a real UTC instant. The route cache key gains an hourly departure bucket so retimed activities get fresh numbers. The dead `travelTimeToNextMinutes` field is removed.

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), Prisma 7 + PostgreSQL, Jest + ts-jest, Google Routes API v2, Google Time Zone API.

**Spec:** `docs/superpowers/specs/2026-08-22-time-aware-travel-times-design.md`

## Global Constraints

- Tests live in `src/lib/__tests__/`, run with `npx jest`. Config: `jest.config.js`, preset `ts-jest`, `testEnvironment: "node"`, `testMatch: **/__tests__/**/*.test.ts`.
- Path alias `@/*` → `./src/*`.
- **Every existing test must pass unmodified.** In particular `driving-times.test.ts` asserts `expect(mockedCalculateRoute).toHaveBeenCalledWith({lat,lng},{lat,lng})` with exactly two arguments. Jest compares the full argument array, so calling `calculateRoute(a, b, undefined)` would fail those assertions. Call sites MUST branch to a genuine two-argument call when there is no departure time. This is a hard requirement, not a style preference.
- All new failure modes degrade to current behaviour (omit `departureTime`). Never surface a new user-facing error, and never fail a schedule load.
- UI copy is Hebrew. Do not change any user-visible string in this plan.
- No new npm dependencies. Timezone maths uses built-in `Intl`.
- `GOOGLE_MAPS_API_KEY` is already required and is reused for the Time Zone API.

---

### Task 1: Local wall-clock → UTC instant conversion

Pure, dependency-free, and the single most likely place for an off-by-one-hour bug, so it gets isolated tests first.

**Files:**
- Create: `src/lib/trip-timezone.ts`
- Test: `src/lib/__tests__/trip-timezone.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `zonedDateTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/trip-timezone.test.ts`:

```ts
import { zonedDateTimeToUtc } from "../trip-timezone"

describe("zonedDateTimeToUtc", () => {
  it("converts a summer (CEST, UTC+2) wall-clock time", () => {
    const d = zonedDateTimeToUtc("2026-09-14", "09:00", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-09-14T07:00:00.000Z")
  })

  it("converts a winter (CET, UTC+1) wall-clock time", () => {
    const d = zonedDateTimeToUtc("2026-12-14", "09:00", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-12-14T08:00:00.000Z")
  })

  it("handles the spring-forward DST boundary", () => {
    // EU DST starts Sun 2026-03-29: 02:00 CET -> 03:00 CEST.
    // 09:00 that day is already CEST (UTC+2).
    const d = zonedDateTimeToUtc("2026-03-29", "09:00", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-03-29T07:00:00.000Z")
  })

  it("handles the fall-back DST boundary", () => {
    // EU DST ends Sun 2026-10-25: 03:00 CEST -> 02:00 CET.
    // 09:00 that day is CET (UTC+1).
    const d = zonedDateTimeToUtc("2026-10-25", "09:00", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-10-25T08:00:00.000Z")
  })

  it("handles a negative UTC offset", () => {
    const d = zonedDateTimeToUtc("2026-09-14", "09:00", "America/New_York")
    expect(d.toISOString()).toBe("2026-09-14T13:00:00.000Z")
  })

  it("handles midnight without rolling to the next day", () => {
    const d = zonedDateTimeToUtc("2026-09-14", "00:00", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-09-13T22:00:00.000Z")
  })

  it("throws on an unparseable date or time", () => {
    expect(() => zonedDateTimeToUtc("not-a-date", "09:00", "Europe/Rome")).toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --testPathPattern=trip-timezone`
Expected: FAIL — `Cannot find module '../trip-timezone'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/trip-timezone.ts`:

```ts
/**
 * Offset in milliseconds between the given instant and how a wall clock in
 * `timeZone` reads it. Positive east of UTC.
 */
function offsetAt(ms: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = dtf.formatToParts(new Date(ms))
  const get = (type: string) => {
    const part = parts.find((p) => p.type === type)
    if (!part) throw new Error(`Missing ${type} in formatted date`)
    return Number(part.value)
  }
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    // Some ICU versions emit hour "24" for midnight under hour12: false.
    get("hour") % 24,
    get("minute"),
    get("second")
  )
  return asUtc - ms
}

/**
 * Interpret `dateStr` ("YYYY-MM-DD") and `timeStr` ("HH:mm") as a wall-clock
 * time in `timeZone`, and return the corresponding UTC instant.
 *
 * Two passes: the first estimates the offset at the naive instant, the second
 * re-measures at the corrected instant so DST transitions land correctly.
 */
export function zonedDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date {
  const naiveMs = Date.parse(`${dateStr}T${timeStr}:00Z`)
  if (Number.isNaN(naiveMs)) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`)
  }
  const firstPass = naiveMs - offsetAt(naiveMs, timeZone)
  const secondPass = naiveMs - offsetAt(firstPass, timeZone)
  return new Date(secondPass)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --testPathPattern=trip-timezone`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trip-timezone.ts src/lib/__tests__/trip-timezone.test.ts
git commit -m "feat: add zoned wall-clock to UTC conversion"
```

---

### Task 2: Timezone lookup and departure-instant helper

**Files:**
- Modify: `src/lib/trip-timezone.ts`
- Test: `src/lib/__tests__/trip-timezone.test.ts`

**Interfaces:**
- Consumes: `zonedDateTimeToUtc` from Task 1.
- Produces:
  - `resolveTimeZone(coords: { lat: number; lng: number }): Promise<string | null>`
  - `departureInstant(dayDate: Date, timeStart: string | null, originCoords: { lat: number; lng: number }): Promise<Date | undefined>`
  - `clearTimeZoneCache(): void` — test-only, mirrors the existing `clearRouteCache` convention in `driving-times.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/trip-timezone.test.ts`, and add the imports to the existing import line at the top:

```ts
import {
  zonedDateTimeToUtc,
  resolveTimeZone,
  departureInstant,
  clearTimeZoneCache,
} from "../trip-timezone"

describe("resolveTimeZone", () => {
  const originalFetch = global.fetch
  const originalKey = process.env.GOOGLE_MAPS_API_KEY

  beforeEach(() => {
    clearTimeZoneCache()
    process.env.GOOGLE_MAPS_API_KEY = "test-key"
    global.fetch = jest.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.GOOGLE_MAPS_API_KEY = originalKey
  })

  const mockOk = (timeZoneId: string) =>
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "OK", timeZoneId }),
    })

  it("returns the IANA id for a coordinate", async () => {
    mockOk("Europe/Rome")
    await expect(resolveTimeZone({ lat: 41.9, lng: 12.5 })).resolves.toBe("Europe/Rome")
  })

  it("caches by rounded coordinates so nearby points share one lookup", async () => {
    mockOk("Europe/Rome")
    await resolveTimeZone({ lat: 41.902, lng: 12.496 })
    await resolveTimeZone({ lat: 41.918, lng: 12.502 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("issues separate lookups for distant coordinates", async () => {
    mockOk("Europe/Rome")
    await resolveTimeZone({ lat: 41.9, lng: 12.5 })
    await resolveTimeZone({ lat: 48.9, lng: 2.4 })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("returns null when the API reports a non-OK status", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS" }),
    })
    await expect(resolveTimeZone({ lat: 0, lng: 0 })).resolves.toBeNull()
  })

  it("returns null when the request throws", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("network"))
    await expect(resolveTimeZone({ lat: 1, lng: 2 })).resolves.toBeNull()
  })
})

describe("departureInstant", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    clearTimeZoneCache()
    process.env.GOOGLE_MAPS_API_KEY = "test-key"
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "OK", timeZoneId: "Europe/Rome" }),
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("combines the day date and start time into a UTC instant", async () => {
    const d = await departureInstant(
      new Date("2026-09-14T00:00:00.000Z"),
      "09:00",
      { lat: 41.9, lng: 12.5 }
    )
    expect(d?.toISOString()).toBe("2026-09-14T07:00:00.000Z")
  })

  it("returns undefined when there is no start time", async () => {
    const d = await departureInstant(
      new Date("2026-09-14T00:00:00.000Z"),
      null,
      { lat: 41.9, lng: 12.5 }
    )
    expect(d).toBeUndefined()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("returns undefined when the timezone cannot be resolved", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("network"))
    const d = await departureInstant(
      new Date("2026-09-14T00:00:00.000Z"),
      "09:00",
      { lat: 41.9, lng: 12.5 }
    )
    expect(d).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --testPathPattern=trip-timezone`
Expected: FAIL — `resolveTimeZone is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/trip-timezone.ts`:

```ts
// Timezone ids never change for a location, so entries never expire.
// Keyed on coordinates rounded to 1 decimal place (~11 km), which keeps a
// whole city on one entry.
const timeZoneCache = new Map<string, string | null>()

function tzCacheKey(coords: { lat: number; lng: number }): string {
  return `${coords.lat.toFixed(1)},${coords.lng.toFixed(1)}`
}

/** @internal — exported for testing only */
export function clearTimeZoneCache() {
  timeZoneCache.clear()
}

/**
 * Resolve the IANA timezone id for a coordinate via the Google Time Zone API.
 * Returns null on any failure; callers fall back to omitting the departure
 * time, which reproduces the previous live-traffic behaviour.
 */
export async function resolveTimeZone(coords: {
  lat: number
  lng: number
}): Promise<string | null> {
  const key = tzCacheKey(coords)
  const cached = timeZoneCache.get(key)
  if (cached !== undefined) return cached

  let result: string | null = null
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured")

    const url = new URL("https://maps.googleapis.com/maps/api/timezone/json")
    url.searchParams.set("location", `${coords.lat},${coords.lng}`)
    url.searchParams.set(
      "timestamp",
      String(Math.floor(Date.now() / 1000))
    )
    url.searchParams.set("key", apiKey)

    const response = await fetch(url.toString())
    if (response.ok) {
      const data = await response.json()
      if (data?.status === "OK" && typeof data.timeZoneId === "string") {
        result = data.timeZoneId
      }
    }
  } catch {
    result = null
  }

  timeZoneCache.set(key, result)
  return result
}

/**
 * Build the UTC instant at which a traveller departs `originCoords` for an
 * activity starting at `timeStart` (local wall clock) on `dayDate`.
 *
 * Returns undefined when there is no start time or the timezone is unknown,
 * in which case callers omit departureTime entirely.
 */
export async function departureInstant(
  dayDate: Date,
  timeStart: string | null,
  originCoords: { lat: number; lng: number }
): Promise<Date | undefined> {
  if (!timeStart) return undefined

  const timeZone = await resolveTimeZone(originCoords)
  if (!timeZone) return undefined

  // dayDate is a date-only column; read its calendar date in UTC to avoid a
  // server-local shift moving the trip a day.
  const dateStr = dayDate.toISOString().split("T")[0]

  try {
    return zonedDateTimeToUtc(dateStr, timeStart, timeZone)
  } catch {
    return undefined
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --testPathPattern=trip-timezone`
Expected: PASS, 15 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/trip-timezone.ts src/lib/__tests__/trip-timezone.test.ts
git commit -m "feat: resolve destination timezone and departure instant"
```

---

### Task 3: `calculateRoute` accepts an optional departure time

**Files:**
- Modify: `src/lib/google-maps.ts:143-199`

**Interfaces:**
- Consumes: nothing.
- Produces: `calculateRoute(origin, destination, options?: { departureTime?: Date }): Promise<RouteResult>`

There is no unit test for `google-maps.ts` in this repo (it is the module other tests mock out), so this task is verified by type-check and by the consuming tests in Tasks 4 and 6.

- [ ] **Step 1: Add the optional parameter**

In `src/lib/google-maps.ts`, change the signature at line 143:

```ts
export async function calculateRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  options?: { departureTime?: Date }
): Promise<RouteResult> {
```

- [ ] **Step 2: Build the request body conditionally**

Replace the `body: JSON.stringify({ ... })` argument (currently lines 156-175) with:

```ts
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.lat,
              longitude: origin.lng,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.lat,
              longitude: destination.lng,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        // The Routes API rejects a departureTime in the past. Request latency
        // can make a just-computed "now" already stale, so require a margin.
        ...(options?.departureTime &&
        options.departureTime.getTime() > Date.now() + 60_000
          ? { departureTime: options.departureTime.toISOString() }
          : {}),
      }),
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Confirm existing tests still pass**

Run: `npx jest`
Expected: all suites PASS. The parameter is optional, so no caller changes yet.

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-maps.ts
git commit -m "feat: allow a future departureTime on calculateRoute"
```

---

### Task 4: Departure-aware route cache

**Files:**
- Modify: `src/lib/driving-times.ts`
- Test: `src/lib/__tests__/driving-times.test.ts`

**Interfaces:**
- Consumes: `departureInstant` from Task 2, `calculateRoute` options from Task 3.
- Produces: `computeDrivingTimesForDay(accommodations, activity, when?: { dayDate: Date; timeStart: string | null })`

`when` is deliberately not a ready-made `Date`: the function loops over several accommodations, which on a relocation day can be in different timezones, so the instant must be resolved per accommodation from its own coordinates.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/driving-times.test.ts`. Add this mock alongside the existing `jest.mock("../google-maps")` block at the top of the file:

```ts
jest.mock("../trip-timezone", () => ({
  departureInstant: jest.fn(),
}))
```

and add to the imports:

```ts
import { departureInstant } from "../trip-timezone"

const mockedDepartureInstant = departureInstant as jest.MockedFunction<
  typeof departureInstant
>
```

Then append this suite:

```ts
describe("computeDrivingTimesForDay — departure times", () => {
  const accommodations = [{ name: "Hotel A", coordinates: { lat: 1, lng: 2 } }]
  const activity = {
    attraction: { lat: 3, lng: 4 },
    restaurant: null,
    groceryStore: null,
  }
  const when = { dayDate: new Date("2099-09-14T00:00:00.000Z"), timeStart: "09:00" }

  beforeEach(() => {
    jest.clearAllMocks()
    clearRouteCache()
    mockedCalculateRoute.mockResolvedValue({ durationMinutes: 25, distanceKm: 18.5 })
  })

  it("passes a future departure time through to calculateRoute", async () => {
    const departure = new Date("2099-09-14T07:00:00.000Z")
    mockedDepartureInstant.mockResolvedValue(departure)

    await computeDrivingTimesForDay(accommodations, activity, when)

    expect(mockedCalculateRoute).toHaveBeenCalledWith(
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
      { departureTime: departure }
    )
  })

  it("treats different departure hours as different cache entries", async () => {
    mockedDepartureInstant
      .mockResolvedValueOnce(new Date("2099-09-14T07:00:00.000Z"))
      .mockResolvedValueOnce(new Date("2099-09-14T12:00:00.000Z"))

    await computeDrivingTimesForDay(accommodations, activity, when)
    await computeDrivingTimesForDay(accommodations, activity, {
      ...when,
      timeStart: "14:00",
    })

    expect(mockedCalculateRoute).toHaveBeenCalledTimes(2)
  })

  it("shares a cache entry for the same departure hour", async () => {
    mockedDepartureInstant.mockResolvedValue(new Date("2099-09-14T07:00:00.000Z"))

    await computeDrivingTimesForDay(accommodations, activity, when)
    await computeDrivingTimesForDay(accommodations, activity, when)

    expect(mockedCalculateRoute).toHaveBeenCalledTimes(1)
  })

  it("omits the options argument entirely when there is no departure", async () => {
    mockedDepartureInstant.mockResolvedValue(undefined)

    await computeDrivingTimesForDay(accommodations, activity, when)

    // Exactly two arguments — a trailing `undefined` would break the
    // pre-existing two-argument assertions elsewhere in this file.
    expect(mockedCalculateRoute).toHaveBeenCalledWith(
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 }
    )
  })

  it("does not consult the timezone helper when `when` is omitted", async () => {
    await computeDrivingTimesForDay(accommodations, activity)
    expect(mockedDepartureInstant).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --testPathPattern=driving-times`
Expected: FAIL — the new suite fails because the third argument is ignored. The pre-existing suites should still PASS.

- [ ] **Step 3: Write the implementation**

Rewrite the top half of `src/lib/driving-times.ts`, from the imports down to the end of `clearRouteCache`:

```ts
import { calculateRoute } from "./google-maps"
import { departureInstant } from "./trip-timezone"

// Simple in-memory cache for route calculations.
// Key: "lat1,lng1→lat2,lng2@<bucket>" where bucket is either the departure
// hour ("2026-09-14T09") or "live" when no departure time is known.
const routeCache = new Map<string, { minutes: number; expiresAt: number }>()

// A live-traffic answer goes stale within the hour. A prediction for a future
// slot is stable day to day, so it may be held much longer.
const LIVE_TTL_MS = 60 * 60 * 1000 // 1 hour
const FUTURE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function departureBucket(departureTime: Date | undefined): string {
  if (!departureTime) return "live"
  // Hour resolution: keeps 09:00 and 14:00 distinct while letting minor edits
  // share an entry.
  return departureTime.toISOString().slice(0, 13)
}

function getCacheKey(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  bucket: string
): string {
  return `${origin.lat},${origin.lng}→${dest.lat},${dest.lng}@${bucket}`
}

async function getRouteMinutes(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  departureTime?: Date
): Promise<number> {
  const bucket = departureBucket(departureTime)
  const key = getCacheKey(origin, dest, bucket)
  const cached = routeCache.get(key)

  if (cached && Date.now() < cached.expiresAt) {
    return cached.minutes
  }

  // Branch rather than passing `undefined`: a trailing undefined argument
  // would break two-argument call assertions in the test suite.
  const route = departureTime
    ? await calculateRoute(origin, dest, { departureTime })
    : await calculateRoute(origin, dest)

  const ttl = departureTime ? FUTURE_TTL_MS : LIVE_TTL_MS
  routeCache.set(key, {
    minutes: route.durationMinutes,
    expiresAt: Date.now() + ttl,
  })
  return route.durationMinutes
}

/** @internal — exported for testing only */
export function clearRouteCache() {
  routeCache.clear()
}
```

Then change the `computeDrivingTimesForDay` signature and its accommodation loop:

```ts
export async function computeDrivingTimesForDay(
  accommodations: AccommodationForDriving[],
  activity: ActivityForDriving,
  when?: { dayDate: Date; timeStart: string | null }
): Promise<DrivingTimeFromLodging[]> {
```

and inside the existing `for (const acc of accsWithCoords)` loop, replace the `try` block body with:

```ts
    try {
      // Resolved per accommodation: on a relocation day the two lodgings can
      // sit in different timezones.
      const departure = when
        ? await departureInstant(when.dayDate, when.timeStart, acc.coordinates)
        : undefined

      const minutes = await getRouteMinutes(acc.coordinates, dest, departure)
      results.push({
        accommodationName: acc.name || "לינה",
        minutes,
      })
    } catch {
      // Skip this accommodation if route calculation fails
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --testPathPattern=driving-times`
Expected: PASS — both the pre-existing suites (unmodified) and the new one.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit
git add src/lib/driving-times.ts src/lib/__tests__/driving-times.test.ts
git commit -m "feat: key the route cache by departure hour"
```

---

### Task 5: Wire the schedule read path

Lights up the `🏨→🚗` chip on attraction, restaurant and grocery cards.

**Files:**
- Modify: `src/app/api/trips/[tripId]/schedule/route.ts:186-197`

**Interfaces:**
- Consumes: `computeDrivingTimesForDay(..., when?)` from Task 4.
- Produces: nothing new.

- [ ] **Step 1: Pass the day date and start time**

In the `enrichedActivities` block, replace both `computeDrivingTimesForDay` calls so each forwards the timing context. The activity call becomes:

```ts
          const drivingTimesFromLodging: DrivingTimeFromLodging[] =
            activity.attraction || activity.restaurant || activity.groceryStore
              ? await computeDrivingTimesForDay(dayAccommodations, activity, {
                  dayDate: dayPlan.date,
                  timeStart: activity.timeStart,
                })
              : []
```

and the alternatives call becomes:

```ts
              const drivingTimesFromLodging: DrivingTimeFromLodging[] =
                alt.attraction || alt.restaurant || alt.groceryStore
                  ? await computeDrivingTimesForDay(dayAccommodations, alt, {
                      dayDate: dayPlan.date,
                      timeStart: activity.timeStart,
                    })
                  : []
```

An alternative has no time of its own — it stands in for its parent activity, so it inherits the parent's `timeStart`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npx jest`
Expected: all suites PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/trips/[tripId]/schedule/route.ts"
git commit -m "feat: compute lodging drive times at the activity's start time"
```

---

### Task 6: Wire the driving card

Makes `travelLeg.driveMinutes` — the `X דק׳ נסיעה משוערות` line — time-aware. It already recomputes on every day save, because the PUT handler deletes and recreates all activities.

**Files:**
- Modify: `src/lib/travel-leg-resolve.ts:100-132`
- Modify: `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts:160-167`

**Interfaces:**
- Consumes: `departureInstant` from Task 2, `calculateRoute` options from Task 3.
- Produces: `buildTravelLegForSave(origin, destination, places, accommodations, flights, carRentals, when?: { dayDate: Date; timeStart: string | null })`

The timezone depends on the resolved origin's coordinates, which are only known *inside* this function after endpoint resolution — hence `when` carries the raw date and time rather than a ready-made instant.

- [ ] **Step 1: Add the parameter and compute the instant**

In `src/lib/travel-leg-resolve.ts`, add the import:

```ts
import { departureInstant } from "@/lib/trip-timezone"
```

Change the signature and the route call in `buildTravelLegForSave`:

```ts
export async function buildTravelLegForSave(
  origin: TravelEndpointRef,
  destination: TravelEndpointRef,
  places: PlaceMaps,
  accommodations: Accommodation[],
  flights: FlightLeg[],
  carRentals: CarRental[],
  when?: { dayDate: Date; timeStart: string | null }
): Promise<TravelLegStored | null> {
  const [a, b] = await Promise.all([
    resolveTravelEndpoint(origin, places, accommodations, flights, carRentals),
    resolveTravelEndpoint(destination, places, accommodations, flights, carRentals),
  ])
  if (!a || !b) return null

  // Only resolvable now: the timezone comes from the resolved origin.
  const departure = when
    ? await departureInstant(when.dayDate, when.timeStart, { lat: a.lat, lng: a.lng })
    : undefined

  let driveMinutes: number | undefined
  try {
    // Branch rather than passing `undefined` — see driving-times.ts.
    const route = departure
      ? await calculateRoute({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }, { departureTime: departure })
      : await calculateRoute({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng })
    driveMinutes = route.durationMinutes
  } catch {
    driveMinutes = undefined
  }
```

The rest of the function is unchanged.

- [ ] **Step 2: Pass the timing context from the day PUT**

In `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts`, extend the `buildTravelLegForSave` call at line 160. `dayPlan` is already in scope from `verifyDayPlan` and carries `date`:

```ts
        const built = await buildTravelLegForSave(
          raw.travelLeg.origin,
          raw.travelLeg.destination,
          places,
          accommodations,
          flights,
          carRentals,
          { dayDate: dayPlan.date, timeStart: raw.timeStart ?? null }
        )
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all suites PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/travel-leg-resolve.ts "src/app/api/trips/[tripId]/schedule/[dayId]/route.ts"
git commit -m "feat: compute driving legs at their scheduled departure time"
```

---

### Task 7: Remove the dead `travelTimeToNextMinutes` field

The column is written only as a literal `null` or as a pass-through of an already-null value. Gemini never emits it and no form sets it, so every render guard fails and nothing ever appears in the UI. It is also redundant with the `travel` activity card, which models inter-location driving explicitly.

**Files:**
- Modify: `prisma/schema.prisma:327`
- Create: `prisma/migrations/<generated>/migration.sql`
- Modify: `src/components/schedule/ActivityCard.tsx` (line 52, lines 1000-1009)
- Modify: `src/components/schedule/DayTimeline.tsx` (line 90, 277, 369, 651-664)
- Modify: `src/components/schedule/TripAgenda.tsx` (lines 218-233)
- Modify: `src/lib/export-docx.ts` (line 126, lines 511-531)
- Modify: `src/lib/format-whatsapp.ts` (lines 116-124)
- Modify: `src/app/api/ai/chat/execute/route.ts:63`
- Modify: `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts` (line 42, line 203)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. `ActivityData` in `ActivityCard.tsx` loses its `travelTimeToNextMinutes` field.

- [ ] **Step 1: Remove every UI render path**

In `src/components/schedule/ActivityCard.tsx`, delete the field from the `ActivityData` interface (line 52):

```ts
  travelTimeToNextMinutes: number | null
```

and delete the entire trailing block that begins with the `{/* Travel time to next */}` comment (lines 1000-1009), leaving the component's closing `</div>` intact.

In `src/components/schedule/DayTimeline.tsx`, delete the type member at line 90, the assignment `travelTimeToNextMinutes: a.travelTimeToNextMinutes,` at line 277, the assignment `travelTimeToNextMinutes: null,` at line 369, and the whole `{/* Travel time indicator between activities */}` block (lines 651-664).

In `src/components/schedule/TripAgenda.tsx`, delete the entire block from the `{/*` comment about travel times through its closing `)}` (lines 218-233), so the map body renders only `<ActivityRow ... />`.

- [ ] **Step 2: Remove it from the exporters**

In `src/lib/export-docx.ts`, delete `travelTimeToNextMinutes?: number | null` from the activities type (line 126) and the whole `// Driving time to next activity` block including its `if` and the `paragraphs.push(...)` call (lines 511-531).

In `src/lib/format-whatsapp.ts`, reduce the loop (lines 113-125) to:

```ts
  for (const activity of dayPlan.activities) {
    blocks.push(formatActivity(activity, tripAccommodations, dayPlan.date))
  }
```

If a local type in this file declares `travelTimeToNextMinutes`, remove that member too. `npx tsc --noEmit` in Step 4 will surface it.

- [ ] **Step 3: Remove it from the API layer**

In `src/app/api/ai/chat/execute/route.ts`, delete line 63:

```ts
    travelTimeToNextMinutes: null as number | null,
```

In `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts`, delete the payload type member at line 42 and the write at line 203:

```ts
            travelTimeToNextMinutes: activity.travelTimeToNextMinutes ?? null,
```

- [ ] **Step 4: Type-check to catch any remaining reference**

Run: `npx tsc --noEmit`
Expected: no errors. If one appears, it is a reference this plan missed — delete it the same way.

Then confirm nothing is left:

Run: `grep -rn "travelTimeToNextMinutes" src`
Expected: no output.

- [ ] **Step 5: Drop the column**

In `prisma/schema.prisma`, delete line 327:

```prisma
  travelTimeToNextMinutes Int?
```

Then generate and apply the migration. The column is universally NULL, so there is no data to lose:

```bash
npx prisma migrate dev --name drop_travel_time_to_next
```

Expected: a new migration folder containing `ALTER TABLE "Activity" DROP COLUMN "travelTimeToNextMinutes";`, applied cleanly.

- [ ] **Step 6: Verify and commit**

```bash
npx jest
npm run lint
```

Expected: all suites PASS, lint clean.

```bash
git add -A
git commit -m "refactor: drop unused travelTimeToNextMinutes field"
```

---

### Task 8: Verify in the running app

The preceding tasks are covered by unit tests and the type-checker, but the two user-visible surfaces have never been exercised end to end. This task confirms real numbers render.

**Files:** none modified.

- [ ] **Step 1: Start the dev server**

Use the `preview_start` tool with the project's `.claude/launch.json` entry (create one running `npm run dev` on port 3000 if absent). Do not start the server with Bash.

- [ ] **Step 2: Open a trip with a scheduled day**

Navigate to the trip dashboard and open the Schedule tab for a day that has at least one attraction activity with a start time, and at least one `travel` activity.

- [ ] **Step 3: Confirm the chips render**

Use `read_page` to confirm an attraction card shows a `🏨→🚗 … דק׳` chip and the driving card shows `… דק׳ נסיעה משוערות`. Both must show a number, not a blank.

- [ ] **Step 4: Confirm no runtime errors**

Run `read_console_messages` with `onlyErrors: true` and `preview_logs` with `level: "error"`.
Expected: no errors relating to timezone resolution, routing, or the removed field.

- [ ] **Step 5: Confirm retiming changes the number**

Edit the attraction activity's start time from a morning slot to a late-evening slot, save, and re-read the page. The chip's value should be recomputed — for a city with meaningful rush-hour traffic it will typically differ. If the trip's dates are in the past, note that this correctly falls through to live traffic and the number may not change; in that case verify against a future-dated trip instead.

- [ ] **Step 6: Screenshot and report**

Take a screenshot of the day timeline showing both surfaces, and share it with the user.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| A. `calculateRoute` optional departureTime | 3 |
| B. `trip-timezone.ts` — `resolveTimeZone`, `zonedDateTimeToUtc`, `departureInstant` | 1, 2 |
| C. Cache key departure bucket + split TTL | 4 |
| D. Call sites — schedule GET | 5 |
| D. Call sites — `buildTravelLegForSave` | 6 |
| E. Recalculation on edit | 5, 6 (no new code required — verified in 8) |
| F. Remove `travelTimeToNextMinutes` | 7 |
| Error handling — degrade to current behaviour | 2 (null timezone), 3 (past departure), 4 (route failure) |
| Testing | 1, 2, 4 |

**Correction to the spec:** the spec asserted existing tests would pass unmodified *and* described passing an options argument. Those conflict — Jest compares the full argument array, so `calculateRoute(a, b, undefined)` fails the existing two-argument assertions. Tasks 4 and 6 therefore branch to a genuine two-argument call when no departure time exists, which honours the constraint. This is called out in Global Constraints and asserted directly by a test in Task 4.

**Type consistency:** `when: { dayDate: Date; timeStart: string | null }` is used identically in Tasks 4, 5 and 6. `departureInstant(dayDate, timeStart, originCoords)` has one signature, used in Tasks 4 and 6. `clearTimeZoneCache` mirrors the existing `clearRouteCache` convention.

**Out of scope, per the spec:** saved `travelTimeMinutes` on the attraction/restaurant/grocery lists, and the Postgres-backed route cache.
