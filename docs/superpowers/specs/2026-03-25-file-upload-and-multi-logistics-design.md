# File Upload in Trip Creation & Multi-Logistics Support

**Date:** 2026-03-25
**Status:** Approved

## Summary

Enable file upload (flight confirmations, hotel bookings, rental agreements) during new trip creation — not just after. Make file upload the prominent option. Support multiple flights (including connections and internal flights), multiple accommodations (already supported), and multiple car rentals. When uploading files to an existing trip, show a per-item merge UI so users can choose what to keep and what to add.

## Requirements

1. File upload available when creating a new trip, before the trip exists in DB
2. File upload is prominent (shown above manual entry sections)
3. Manual editing always available alongside file upload
4. Support multiple flight legs (connections, internal flights, return flights — flat array)
5. Support multiple car rentals (flat array)
6. When uploading to an existing trip, show per-item merge UI (existing + new, with checkboxes)
7. Any change (manual or file upload) triggers itinerary sync (`syncLogisticsActivities`)
8. Same component design on both new trip page and trip dashboard

## Data Model Changes

### Flights

**Before:** `{outbound?: FlightLeg, return?: FlightLeg} | null`

**After:** `Array<FlightLeg> | null`

```ts
interface FlightLeg {
  flightNumber?: string
  departureAirport?: string
  departureTime?: string   // ISO YYYY-MM-DDTHH:mm
  arrivalAirport?: string
  arrivalTime?: string     // ISO YYYY-MM-DDTHH:mm
}
```

Flights are displayed sorted by `departureTime`.

### Car Rentals

**Before:** `{company?, pickupLocation?, returnLocation?, additionalDetails?} | null`

**After:** `Array<CarRental> | null`

```ts
interface CarRental {
  company?: string
  pickupLocation?: string
  pickupTime?: string        // ISO YYYY-MM-DDTHH:mm (new field)
  returnLocation?: string
  returnTime?: string        // ISO YYYY-MM-DDTHH:mm (new field)
  additionalDetails?: string
}
```

New `pickupTime` and `returnTime` fields replace the current inference-from-flights logic.

**Key name:** The DB column and JSON key remain `carRental` (singular) even though the value is now an array. All normalizers and consumers must expect `carRental: Array<CarRental> | null`.

### Accommodation

No change — already an array.

### Extraction Response Type

The updated extraction returns:

```ts
interface ExtractedTripDetails {
  destination?: string | null        // new — for auto-filling basic info
  startDate?: string | null          // new — ISO YYYY-MM-DD
  endDate?: string | null            // new — ISO YYYY-MM-DD
  flights: Array<FlightLeg> | null
  accommodation: Array<Accommodation> | null
  carRental: Array<CarRental> | null
}
```

### Migration

No Prisma migration needed (JSON fields). Normalizer functions handle old ↔ new format:

- `normalizeFlights(data)` — converts old `{outbound, return}` to `[outboundLeg, returnLeg]` array (filtering out legs where all fields are empty); passes through arrays as-is
- `normalizeCarRentals(data)` — wraps old single object in array; passes through arrays as-is
- `normalizeAccommodations(data)` — already exists

Normalizers are used everywhere flights/carRental are read.

## New Trip Creation Flow

Single page layout (no tabs):

1. **Basic info** (name, destination, dates) — always at top
2. **File upload zone** — below basic info, always visible
3. **Detail sections** (flights, accommodation, car rentals) — collapsible sections below upload zone, start collapsed

Flow:
- User uploads a file → extracted data populates detail sections (auto-expand)
- User can manually open any section and edit
- User can upload additional files (one at a time, sequential) → new extractions accumulate
- User clicks "Create Trip" → `POST /api/trips` with all data

File upload and manual editing share the same state — complementary, not alternative.

**Partial extraction:** If extraction succeeds but only some categories have data (e.g., flights found but no car rental), only the found categories populate the form. No warning needed — this is expected behavior (a flight confirmation won't have hotel info).

## Merge UI (Existing Trip Updates)

When uploading a file to a trip that already has data in a given category:

Per-category checklist showing all items (existing + newly extracted):
- Each item has a checkbox (pre-checked by default for both existing and new)
- Existing items labeled "קיים", new items labeled "חדש"
- User unchecks items they don't want
- Confirm → checked items become the new full set

When a category is empty and new data arrives, skip merge UI — just add the items directly.

**Duplicates:** No automatic duplicate detection. If a user uploads the same flight confirmation twice, both entries appear in the checklist. The user is responsible for unchecking duplicates.

After confirm → save via `PUT /api/trips/:id` → trigger `syncLogisticsActivities`.

## Standalone Extract API

**New endpoint:** `POST /api/extract`

- Requires user authentication (no tripId needed)
- Takes a file via FormData
- Sends to Gemini, returns extracted JSON
- Same validation as existing endpoint (PDF/JPG/PNG/WebP, max 10MB)

**Updated Gemini extraction prompt:**
- `flights` → array of legs (not `{outbound, return}`)
- `carRental` → array of objects
- Car rental objects include `pickupTime` and `returnTime`
- Also extract `destination`, `startDate`, `endDate` when available (for auto-filling basic info)

Existing `/api/trips/[tripId]/extract` stays but uses the same extraction function.

## Sync-Logistics Adaptation

`syncLogisticsActivities` updated for arrays:

**Flights:** iterate over flights array sorted by `departureTime`. For each flight at index `i`:
- Create `flight_departure` activity with `sortOrder = i * 10` (with pre-flight buffer)
- Create `flight_arrival` activity with `sortOrder = i * 10 + 1`

**Car rentals:** iterate over car rentals array. For each rental at index `j`:
- Use explicit `pickupTime`/`returnTime` for activity times
- **Fallback for legacy data** (no explicit times): use first flight's arrival for pickup, last flight's departure for return. This fallback only applies when there are exactly 0 or 2 flights (the old outbound/return pattern). With 3+ flights, car rental times are required — skip creating activities if missing.
- Create `car_pickup` with `sortOrder = 500 + j * 10`
- Create `car_return` with `sortOrder = 500 + j * 10 + 1`

## Component Architecture

### Shared Components

| Component | Purpose |
|-----------|---------|
| `FileUploadZone` | Drag-and-drop upload, calls extract API, returns extracted JSON |
| `FlightsList` | Display/edit array of flights (add/remove items) |
| `CarRentalsList` | Display/edit array of car rentals (add/remove items) |
| `AccommodationsList` | Extracted from existing TripForm code as reusable component |
| `MergeReview` | Checkbox list of existing + new items per category |

### TripForm (New Trip Page)

- Basic info fields
- `FileUploadZone`
- `FlightsList`, `AccommodationsList`, `CarRentalsList` as collapsible sections
- File upload populates sections; manual edit always available
- Submit creates trip with all data

### TripDashboard (Existing Trip)

- Same `FileUploadZone` + detail sections
- On extraction with existing data → show `MergeReview`
- On confirm → `PUT /api/trips/:id` → `syncLogisticsActivities`

## Files Affected

### New Files
- `src/app/api/extract/route.ts` — standalone extract endpoint
- `src/components/trips/FileUploadZone.tsx` — upload zone component
- `src/components/trips/FlightsList.tsx` — flights list editor
- `src/components/trips/CarRentalsList.tsx` — car rentals list editor
- `src/components/trips/AccommodationsList.tsx` — accommodations list editor
- `src/components/trips/MergeReview.tsx` — merge UI component
- `src/lib/normalizers.ts` — `normalizeFlights()` and `normalizeCarRentals()` (co-located since they're small)

### Modified Files
- `src/components/trips/TripForm.tsx` — new layout with upload + sections
- `src/components/trips/TripDashboard.tsx` — use shared components + merge UI
- `src/components/trips/FileUploadExtractor.tsx` — delete (replaced by `FileUploadZone` + `MergeReview`)
- `src/lib/gemini.ts` — update `ExtractedTripDetails` interface and prompt
- `src/lib/sync-logistics.ts` — iterate over arrays instead of outbound/return
- `src/app/api/trips/route.ts` — handle new flights/carRental array format on create
- `src/app/api/trips/[tripId]/route.ts` — normalize on update
- `src/app/api/trips/[tripId]/extract/route.ts` — reuse shared extraction logic
- `src/lib/export-docx.ts` — update `buildFlightSection` and `buildCarRentalSection` for arrays
- `src/app/shared/[token]/page.tsx` — update shared trip view for array-based flights/carRental
