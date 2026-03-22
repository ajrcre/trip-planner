# Auto-Generated Logistics Activities

**Date:** 2026-03-22
**Status:** Approved

## Overview

Automatically add flight and car rental logistics activities to the trip itinerary. Activities are synced from trip flight/car rental data and are fully editable by the user.

## Data Model Changes

### FamilyProfile — 3 new fields

- `preFlightArrivalMinutes Int @default(180)` — arrive at airport before departure (default 3 hours)
- `carPickupDurationMinutes Int @default(120)` — time to pick up rental car (default 2 hours)
- `carReturnDurationMinutes Int @default(60)` — time to return rental car (default 1 hour)

### Activity — 4 new type values

No schema change needed (`type` is already a String):

| Type | Icon | Hebrew Label |
|------|------|-------------|
| `flight_departure` | ✈️ | טיסת יציאה |
| `flight_arrival` | 🛬 | טיסת הגעה |
| `car_pickup` | 🚗 | איסוף רכב |
| `car_return` | 🔑 | החזרת רכב |

## Sync Logic

### `syncLogisticsActivities(tripId)`

Server-side utility function that:

1. Loads the trip (flights, carRental) and the user's family profile (duration settings)
2. **Deletes** all existing activities with logistics types for this trip
3. **Recreates** them from current trip data (delete-and-recreate ensures source data always wins)

### Generated Activities

**Flight departure (outbound):**
- Day: matches `flights.outbound.departureTime` date
- timeStart = departureTime minus `preFlightArrivalMinutes`
- timeEnd = departureTime
- Notes: flight number + departure airport

**Flight arrival (outbound):**
- Day: matches `flights.outbound.arrivalTime` date
- timeStart = arrivalTime, timeEnd = null
- Notes: flight number + arrival airport

**Flight departure (return):**
- Same pattern as outbound departure, using `flights.return`

**Flight arrival (return):**
- Same pattern as outbound arrival, using `flights.return`

**Car pickup:**
- Day: same day as outbound flight arrival (or trip start if no flight)
- timeStart = flight arrival time (or null)
- timeEnd = timeStart + `carPickupDurationMinutes`
- Notes: rental company + pickup location

**Car return:**
- Day: same day as return flight departure (or trip end if no flight)
- timeStart = return flight airport arrival minus `carReturnDurationMinutes` minus `preFlightArrivalMinutes`
- timeEnd = timeStart + `carReturnDurationMinutes`
- Notes: rental company + return location

### Trigger Points

- **POST `/trips/[tripId]/schedule`** — after creating day plans
- **PUT `/trips/[tripId]`** — after updating trip, if `flights` or `carRental` changed

### Sync Behavior

- When source data (flight/car rental) is updated, logistics activities are **replaced** (any manual edits are overwritten)
- This is intentional: these are logistics tied to real bookings, so they should stay in sync

## Family Profile UI

New section **"זמני לוגיסטיקה"** in FamilyProfileForm, after flight constraints:

- **הגעה לשדה תעופה לפני טיסה** — number input in hours (default 3)
- **איסוף רכב שכור** — number input in minutes (default 120)
- **החזרת רכב שכור** — number input in minutes (default 60)

Saved via existing PUT `/api/family` endpoint.

## ActivityCard Updates

Add the 4 logistics types to `typeConfig` with appropriate icons. Cards are fully editable (same edit flow as any other activity — time fields + notes). Users can delete them if desired. No special "auto-generated" badge — the type-specific icon provides sufficient visual distinction.
