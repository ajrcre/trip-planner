# Time-aware travel times

**Date:** 2026-08-22

## Problem

Every travel time in the app is computed with `routingPreference: "TRAFFIC_AWARE"` and **no** `departureTime`. When `departureTime` is omitted, the Google Routes API defaults to the moment the request was made. So a "23 דק׳" badge on a 09:00 activity actually reflects traffic at whatever hour the server happened to make the call — often months before the trip, and at an unrelated time of day.

Two surfaces show these numbers to the user:

| Card | Label | Source | Computed |
|---|---|---|---|
| Driving card (`type: "travel"`) | `X דק׳ נסיעה משוערות` | `travelLeg.driveMinutes` | On day save |
| Attraction / restaurant / grocery | `🏨→🚗 X דק׳` | `drivingTimesFromLodging` | On every schedule read |

## Goals

1. Travel times reflect the time of day the user will actually be travelling, in the destination's local time.
2. Times refresh when an activity is edited — including when only its start time changes.
3. No increase in billing tier, and no meaningful loss of cache effectiveness.

## Non-goals

- **Saved `travelTimeMinutes` on the attraction / restaurant / grocery lists.** These are computed once at save time and have no time-of-day context to work from — a list item isn't scheduled. Making them time-aware would require inventing a reference time. Left as-is.
- **Trips whose dates have already passed.** The Routes API only accepts a future `departureTime` for traffic-aware routing. Past dates fall through to current behaviour rather than getting a compensating mechanism.

---

## Design

### A. `calculateRoute` accepts an optional departure time

`src/lib/google-maps.ts`

```ts
export async function calculateRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  options?: { departureTime?: Date }
): Promise<RouteResult>
```

`departureTime` is added to the request body as RFC 3339 **only when** it is supplied and is more than 60 seconds in the future. The margin matters because request latency can make a just-computed "now" already past by the time Google evaluates it, which the API rejects.

Otherwise the field is omitted and behaviour is identical to today. Every existing call site keeps working without modification.

**Billing note:** this does not change the SKU. `TRAFFIC_AWARE` already bills at Compute Routes **Pro**, per Google's [Routes API usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing). Adding `departureTime` adds no cost per call.

### B. Timezone resolution — new module `src/lib/trip-timezone.ts`

09:00 in Rome is not 09:00 on the server, and `Trip` has no timezone field. Two exports:

```ts
resolveTimeZone(coords: { lat: number; lng: number }): Promise<string | null>
```

Calls the Google Time Zone API and returns an IANA id (`"Europe/Rome"`). Cached at module level, keyed on coordinates rounded to 1 decimal place (≈11 km), with no expiry — a location's timezone identifier does not change. In practice this is one call per city per process.

Resolving from the **route's origin coordinates** rather than a single trip-level timezone means multi-country trips work correctly with no extra modelling.

```ts
zonedDateTimeToUtc(dateStr: "YYYY-MM-DD", timeStr: "HH:mm", timeZone: string): Date
```

Pure function, built on `Intl.DateTimeFormat` with a two-pass offset correction. Returning the IANA id from the API — rather than its `rawOffset`/`dstOffset` for one instant — means a single cached lookup covers every date in the trip, including one that straddles a DST change.

A convenience wrapper combines the two:

```ts
departureInstant(
  dayDate: Date,
  timeStart: string | null,
  originCoords: { lat: number; lng: number }
): Promise<Date | undefined>
```

Returns `undefined` when there is no start time or the timezone cannot be resolved.

### C. Cache key gains a departure bucket

`src/lib/driving-times.ts`

```
lat1,lng1→lat2,lng2@2026-09-14T09     // scheduled departure, bucketed to the hour
lat1,lng1→lat2,lng2@live              // no departure time
```

Bucketing to the hour keeps 09:00 and 14:00 distinct while allowing minor edits to share an entry.

**This does not reduce the hit rate.** The bucket derives from the trip's date and the activity's start time — fixed properties of stored data, not from "now". The same activity therefore produces the same key on every request. The key changes only when the activity's time is actually edited, which is precisely when a fresh number is wanted.

**TTL is split by kind:**

| Kind | TTL | Rationale |
|---|---|---|
| `@live` (no departure) | 1 hour | Live traffic goes stale quickly |
| Future-dated departure | 24 hours | Google's prediction for a future slot is stable day to day |

The longer TTL for future slots is the main call-volume saving in this design, and it applies to the majority of lookups.

`computeDrivingTimesForDay` gains an optional trailing `when?: { dayDate: Date; timeStart: string | null }` — not a ready-made `Date`. It loops over several accommodations, which on a relocation day may sit in different timezones, so the departure instant must be resolved per accommodation inside the loop using that accommodation's own coordinates.

### D. Call sites

**Schedule GET** (`src/app/api/trips/[tripId]/schedule/route.ts`) — passes `{ dayDate: dayPlan.date, timeStart: activity.timeStart }` to `computeDrivingTimesForDay`, which resolves the instant per accommodation as described above.

**`buildTravelLegForSave`** (`src/lib/travel-leg-resolve.ts`) — takes `when?: { dayDate: Date; timeStart: string | null }` rather than a ready-made `Date`. The timezone depends on the resolved origin's coordinates, which are only known *inside* this function after endpoint resolution, so the instant is computed there, between resolving endpoints and calling `calculateRoute`. The day PUT handler already has `dayPlan.date` in scope from `verifyDayPlan`.

### E. Recalculation on edit

No explicit invalidation logic is required; the existing architecture covers all three cases:

- **Driving cards** — the day PUT deletes and recreates every activity, so `buildTravelLegForSave` already re-runs on every save. It now recomputes against the new departure time.
- **Hotel chips** — computed on every schedule GET. With the departure bucket in the cache key, a retimed activity yields a different key and fetches fresh.
- **A moved activity** — changing `timeStart` changes the bucket, so both surfaces update.

### F. Remove the dead `travelTimeToNextMinutes` field

The column is written only as a literal `null` or as a pass-through of an already-null value; Gemini never emits it and no form sets it. It is always NULL, so every render guard fails and nothing ever appears in the UI. It is dead code, not stale data.

It is also conceptually redundant: inter-location driving is already modelled explicitly as a `travel` activity with its own card, origin, destination and computed minutes. Keeping a second, implicit mechanism invites two representations of the same drive that can disagree.

Removed from:

| File | What |
|---|---|
| `prisma/schema.prisma` + new migration | The `travelTimeToNextMinutes` column |
| `src/components/schedule/ActivityCard.tsx` | `ActivityData` field (52), footer render (1001–1009) |
| `src/components/schedule/DayTimeline.tsx` | Type (90), assignments (277, 369), pill render (651–664) |
| `src/components/schedule/TripAgenda.tsx` | Pill render (223–233) and its `attractionsOnly` comment |
| `src/lib/export-docx.ts` | Type (126), render (513–524) |
| `src/lib/format-whatsapp.ts` | Render (119–123) |
| `src/app/api/ai/chat/execute/route.ts` | Null write (63) |
| `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts` | Payload type (42), write (203) |

The migration drops a column that is universally NULL, so there is no data to lose.

---

## Error handling

Every new failure mode degrades to today's behaviour rather than surfacing an error:

- **Time Zone API fails or returns no id** → `departureInstant` returns `undefined` → `departureTime` omitted → live traffic, as today.
- **Departure instant is in the past** → omitted, same fall-through. This is the deliberate answer for past-dated trips.
- **Route call fails** → unchanged; the existing `catch` in `computeDrivingTimesForDay` skips that accommodation, and `buildTravelLegForSave` leaves `driveMinutes` undefined.

No new user-facing error states, and no new way for a schedule to fail to load.

## Testing

Extending `src/lib/__tests__/driving-times.test.ts`, where `calculateRoute` is already mocked:

- A supplied future departure reaches `calculateRoute`.
- 09:00 and 14:00 at the same coordinates produce two calls, not a cache hit.
- Two activities at the same place and hour produce one call.
- A past departure is omitted from the call.
- Future-dated entries survive past the 1-hour live TTL; `@live` entries do not.

New `src/lib/__tests__/trip-timezone.test.ts`:

- `zonedDateTimeToUtc` for a plain date, and across both DST boundaries (spring forward, fall back).
- Repeated `resolveTimeZone` calls for nearby coordinates hit the cache once.

All existing tests must pass unmodified — the new parameters are optional and default to current behaviour.

## Cost impact

- **No SKU change.** `TRAFFIC_AWARE` already bills at Compute Routes Pro ($10/1,000 after 5,000 free monthly).
- **Time Zone API** — roughly one call per city per process, permanently cached. 10,000 free per month.
- **Cache hit rate** — effectively unchanged, since the bucket derives from stored data rather than wall-clock time.
- **Net effect** — the 24-hour TTL on future-dated slots should *reduce* total call volume versus today's uniform 1-hour expiry.

## Known limitation

The route cache is an in-process `Map`. On serverless, each instance holds its own copy and cold starts discard it, so the real-world hit rate is lower than the TTL implies. Moving it to a Postgres table keyed on origin / destination / departure bucket would make hits durable across instances and deploys, and is the largest available saving. Deferred: it is a schema migration plus new code, and the free tier likely makes it unnecessary.
