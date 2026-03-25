# File Upload & Multi-Logistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable file upload during new trip creation (as the default flow), support multiple flights and car rentals (flat arrays), and add a merge UI for uploading to existing trips.

**Architecture:** Data model changes flights from `{outbound, return}` to a flat array and carRental from a single object to an array. Normalizer functions handle backward compatibility with old data. A standalone extract API enables file upload before trip creation. Shared UI components (list editors + merge review) are used on both the new trip page and the trip dashboard.

**Tech Stack:** Next.js 15, React, TypeScript, Prisma (JSON fields), Gemini AI (extraction), Jest (testing)

**Spec:** `docs/superpowers/specs/2026-03-25-file-upload-and-multi-logistics-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/normalizers.ts` | `normalizeFlights()` and `normalizeCarRentals()` — convert old format to arrays |
| `src/lib/__tests__/normalizers.test.ts` | Tests for normalizer functions |
| `src/app/api/extract/route.ts` | Standalone file extraction endpoint (no tripId required) |
| `src/components/trips/FileUploadZone.tsx` | Drag-and-drop upload zone, calls extract API, returns extracted JSON |
| `src/components/trips/FlightsList.tsx` | Display/edit array of flights (add/remove) |
| `src/components/trips/CarRentalsList.tsx` | Display/edit array of car rentals (add/remove) |
| `src/components/trips/AccommodationsList.tsx` | Extracted from TripForm, reusable accommodation list editor |
| `src/components/trips/MergeReview.tsx` | Per-item merge UI (existing + new items with checkboxes) |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/gemini.ts` | Update `ExtractedTripDetails` interface and extraction prompt for arrays + basic info fields |
| `src/lib/sync-logistics.ts` | Iterate over flights/carRental arrays; use normalizers; new sortOrder strategy |
| `src/lib/export-docx.ts` | Update `TripData` interface and `buildFlightSection`/`buildCarRentalSection` for arrays |
| `src/components/trips/TripForm.tsx` | New layout: basic info + upload zone + collapsible detail sections |
| `src/components/trips/TripDashboard.tsx` | Use shared components + merge UI for file uploads |
| `src/app/api/trips/route.ts` | Handle new array format on create |
| `src/app/api/trips/[tripId]/route.ts` | Normalize flights/carRental on update |
| `src/app/api/trips/[tripId]/extract/route.ts` | Reuse shared extraction function |
| `src/app/shared/[token]/page.tsx` | Update shared trip view for array-based flights/carRental |

### Deleted Files

| File | Reason |
|------|--------|
| `src/components/trips/FileUploadExtractor.tsx` | Replaced by `FileUploadZone` + `MergeReview` |

---

## Task 1: Normalizer Functions

**Files:**
- Create: `src/lib/normalizers.ts`
- Create: `src/lib/__tests__/normalizers.test.ts`

- [ ] **Step 1: Write failing tests for `normalizeFlights`**

```ts
// src/lib/__tests__/normalizers.test.ts
import { normalizeFlights, normalizeCarRentals } from "../normalizers"

describe("normalizeFlights", () => {
  it("returns empty array for null", () => {
    expect(normalizeFlights(null)).toEqual([])
  })

  it("returns empty array for undefined", () => {
    expect(normalizeFlights(undefined)).toEqual([])
  })

  it("passes through a valid array", () => {
    const flights = [
      { flightNumber: "LY001", departureAirport: "TLV", arrivalAirport: "JFK" },
    ]
    expect(normalizeFlights(flights)).toEqual(flights)
  })

  it("converts old {outbound, return} format to array", () => {
    const old = {
      outbound: { flightNumber: "LY001", departureAirport: "TLV", arrivalAirport: "JFK", departureTime: "2026-04-15T08:00", arrivalTime: "2026-04-15T14:00" },
      return: { flightNumber: "LY002", departureAirport: "JFK", arrivalAirport: "TLV", departureTime: "2026-04-22T18:00", arrivalTime: "2026-04-23T10:00" },
    }
    expect(normalizeFlights(old)).toEqual([old.outbound, old.return])
  })

  it("filters out empty legs from old format", () => {
    const old = {
      outbound: { flightNumber: "LY001", departureAirport: "TLV" },
      return: { flightNumber: "", departureAirport: "", departureTime: "", arrivalAirport: "", arrivalTime: "" },
    }
    expect(normalizeFlights(old)).toEqual([{ flightNumber: "LY001", departureAirport: "TLV" }])
  })

  it("handles old format with only outbound", () => {
    const old = { outbound: { flightNumber: "LY001" }, return: null }
    expect(normalizeFlights(old)).toEqual([{ flightNumber: "LY001" }])
  })

  it("handles old format with null outbound and return", () => {
    const old = { outbound: null, return: null }
    expect(normalizeFlights(old)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/__tests__/normalizers.test.ts --verbose`
Expected: FAIL — cannot find module `../normalizers`

- [ ] **Step 3: Implement `normalizeFlights`**

```ts
// src/lib/normalizers.ts

export interface FlightLeg {
  flightNumber?: string | null
  departureAirport?: string | null
  departureTime?: string | null
  arrivalAirport?: string | null
  arrivalTime?: string | null
}

export interface CarRental {
  company?: string | null
  pickupLocation?: string | null
  pickupTime?: string | null
  returnLocation?: string | null
  returnTime?: string | null
  additionalDetails?: string | null
}

function isNonEmptyLeg(leg: unknown): leg is FlightLeg {
  if (!leg || typeof leg !== "object") return false
  const l = leg as Record<string, unknown>
  return !!(l.flightNumber || l.departureAirport || l.departureTime || l.arrivalAirport || l.arrivalTime)
}

/**
 * Normalize flights data for backward compatibility.
 *
 * - null/undefined → []
 * - array → pass through
 * - old {outbound, return} format → convert to flat array, filtering empty legs
 */
export function normalizeFlights(data: unknown): FlightLeg[] {
  if (data == null) return []

  if (Array.isArray(data)) return data as FlightLeg[]

  if (typeof data === "object" && ("outbound" in data || "return" in data)) {
    const old = data as { outbound?: unknown; return?: unknown }
    const legs: FlightLeg[] = []
    if (isNonEmptyLeg(old.outbound)) legs.push(old.outbound)
    if (isNonEmptyLeg(old.return)) legs.push(old.return)
    return legs
  }

  return []
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/normalizers.test.ts --verbose`
Expected: All `normalizeFlights` tests PASS

- [ ] **Step 5: Write failing tests for `normalizeCarRentals`**

Add to `normalizers.test.ts`:

```ts
describe("normalizeCarRentals", () => {
  it("returns empty array for null", () => {
    expect(normalizeCarRentals(null)).toEqual([])
  })

  it("returns empty array for undefined", () => {
    expect(normalizeCarRentals(undefined)).toEqual([])
  })

  it("passes through a valid array", () => {
    const rentals = [{ company: "Hertz", pickupLocation: "JFK" }]
    expect(normalizeCarRentals(rentals)).toEqual(rentals)
  })

  it("wraps single object in array", () => {
    const single = { company: "Hertz", pickupLocation: "JFK", returnLocation: "JFK" }
    expect(normalizeCarRentals(single)).toEqual([single])
  })

  it("returns empty array for empty object", () => {
    expect(normalizeCarRentals({})).toEqual([])
  })

  it("returns empty array for object with all empty strings", () => {
    expect(normalizeCarRentals({ company: "", pickupLocation: "" })).toEqual([])
  })
})
```

- [ ] **Step 6: Implement `normalizeCarRentals`**

Add to `src/lib/normalizers.ts`:

```ts
/**
 * Normalize car rental data for backward compatibility.
 *
 * - null/undefined → []
 * - array → pass through
 * - single object with any non-empty field → wrap in array
 * - empty object → []
 */
export function normalizeCarRentals(data: unknown): CarRental[] {
  if (data == null) return []

  if (Array.isArray(data)) return data as CarRental[]

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>
    const hasContent = !!(obj.company || obj.pickupLocation || obj.returnLocation || obj.additionalDetails || obj.pickupTime || obj.returnTime)
    return hasContent ? [data as CarRental] : []
  }

  return []
}
```

- [ ] **Step 7: Run all normalizer tests**

Run: `npx jest src/lib/__tests__/normalizers.test.ts --verbose`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/normalizers.ts src/lib/__tests__/normalizers.test.ts
git commit -m "feat: add normalizeFlights and normalizeCarRentals functions with tests"
```

---

## Task 2: Update Gemini Extraction Interface and Prompt

**Files:**
- Modify: `src/lib/gemini.ts:14-93`

- [ ] **Step 1: Update `ExtractedTripDetails` interface**

In `src/lib/gemini.ts`, replace the `ExtractedTripDetails` interface (lines 14-45) with:

```ts
export interface ExtractedTripDetails {
  destination?: string | null
  startDate?: string | null
  endDate?: string | null
  flights: Array<{
    flightNumber?: string | null
    departureAirport?: string | null
    departureTime?: string | null
    arrivalAirport?: string | null
    arrivalTime?: string | null
  }> | null
  accommodation: Array<{
    name?: string | null
    address?: string | null
    checkIn?: string | null
    checkOut?: string | null
    contact?: string | null
    bookingReference?: string | null
  }> | null
  carRental: Array<{
    company?: string | null
    pickupLocation?: string | null
    pickupTime?: string | null
    returnLocation?: string | null
    returnTime?: string | null
    additionalDetails?: string | null
  }> | null
}
```

- [ ] **Step 2: Update `EXTRACTION_PROMPT`**

Replace the `EXTRACTION_PROMPT` constant (lines 47-65) with:

```ts
const EXTRACTION_PROMPT = `אתה מערכת לחילוץ מידע ממסמכי נסיעות.
נתח את הקובץ המצורף וחלץ ממנו את פרטי הנסיעה הבאים, אם הם קיימים במסמך.
החזר את התוצאה כ-JSON בלבד, בלי טקסט נוסף, בפורמט הבא:
{
  "destination": "שם היעד",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "flights": [
    { "flightNumber": "...", "departureAirport": "...", "departureTime": "YYYY-MM-DDTHH:mm", "arrivalAirport": "...", "arrivalTime": "YYYY-MM-DDTHH:mm" }
  ],
  "accommodation": [
    { "name": "...", "address": "...", "checkIn": "YYYY-MM-DDTHH:mm", "checkOut": "YYYY-MM-DDTHH:mm", "contact": "...", "bookingReference": "..." }
  ],
  "carRental": [
    { "company": "...", "pickupLocation": "...", "pickupTime": "YYYY-MM-DDTHH:mm", "returnLocation": "...", "returnTime": "YYYY-MM-DDTHH:mm", "additionalDetails": "..." }
  ]
}

כללים:
- החזר רק JSON תקין, בלי markdown, בלי backticks, בלי הסברים.
- אם שדה לא נמצא במסמך, השתמש ב-null.
- אם קטגוריה שלמה (טיסות/לינה/רכב) לא נמצאת, השתמש ב-null עבור המערך כולו.
- flights הוא מערך. כל רגל טיסה (כולל קונקשנים, טיסות פנימיות, טיסת חזור) היא אובייקט נפרד במערך.
- accommodation הוא מערך. אם יש כמה בתי מלון או מקומות לינה, החזר כל אחד כאובייקט נפרד במערך.
- carRental הוא מערך. אם יש כמה השכרות רכב, החזר כל אחת כאובייקט נפרד במערך.
- אם ניתן לזהות את יעד הנסיעה, תאריך התחלה או תאריך סיום, מלא אותם. אם לא, השתמש ב-null.
- תאריכים בפורמט ISO: YYYY-MM-DDTHH:mm (או YYYY-MM-DD עבור startDate/endDate)
- שמות שדות תעופה בקוד IATA אם אפשר (לדוגמה: TLV, JFK).`
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Type errors in files that still use the old interface (expected — we'll fix them in subsequent tasks)

- [ ] **Step 4: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: update extraction interface for array-based flights and carRentals"
```

---

## Task 3: Standalone Extract API

**Files:**
- Create: `src/app/api/extract/route.ts`
- Modify: `src/app/api/trips/[tripId]/extract/route.ts`

- [ ] **Step 1: Create standalone extract endpoint**

```ts
// src/app/api/extract/route.ts
import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { extractTripDetails } from "@/lib/gemini"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]

export async function POST(request: Request) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File type not supported. Use PDF, JPG, or PNG." },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum 10MB." },
      { status: 400 }
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString("base64")
    const extracted = await extractTripDetails(base64, file.type)
    return NextResponse.json(extracted)
  } catch (error) {
    console.error("Extraction error:", error)
    return NextResponse.json(
      { error: "Failed to extract trip details from file" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Update existing extract endpoint to reuse same function**

The existing `src/app/api/trips/[tripId]/extract/route.ts` already calls `extractTripDetails` from gemini.ts, so it will automatically use the updated interface. No changes needed beyond verifying it compiles.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "feat: add standalone extract API endpoint (no tripId required)"
```

---

## Task 4: Update Sync-Logistics for Arrays

**Files:**
- Modify: `src/lib/sync-logistics.ts`

- [ ] **Step 1: Update imports and interfaces**

At the top of `src/lib/sync-logistics.ts`, replace the `FlightLeg`, `FlightsData`, and `CarRentalData` interfaces (lines 3-22) with imports from normalizers:

```ts
import { normalizeFlights, normalizeCarRentals, type FlightLeg, type CarRental } from "./normalizers"
```

- [ ] **Step 2: Update the flight activity creation logic**

Replace lines 127-221 (the `flights` variable declaration through all 4 flight activity blocks) with:

```ts
  const flights = normalizeFlights(trip.flights)
    .filter((f) => f.departureTime || f.arrivalTime)
    .sort((a, b) => {
      const aTime = a.departureTime || a.arrivalTime || ""
      const bTime = b.departureTime || b.arrivalTime || ""
      return aTime.localeCompare(bTime)
    })

  // === Flight activities ===
  for (let i = 0; i < flights.length; i++) {
    const flight = flights[i]

    if (flight.departureTime) {
      const dateStr = isoToDateStr(flight.departureTime)
      const dayPlanId = dayPlanByDate.get(dateStr)
      if (dayPlanId) {
        const depTime = isoToTime(flight.departureTime)
        activitiesToCreate.push({
          dayPlanId,
          sortOrder: i * 10,
          timeStart: subtractMinutes(depTime, preFlightArrivalMinutes),
          timeEnd: depTime,
          type: "flight_departure",
          notes: joinNotes(flight.flightNumber, flight.departureAirport),
        })
      }
    }

    if (flight.arrivalTime) {
      const dateStr = isoToDateStr(flight.arrivalTime)
      const dayPlanId = dayPlanByDate.get(dateStr)
      if (dayPlanId) {
        activitiesToCreate.push({
          dayPlanId,
          sortOrder: i * 10 + 1,
          timeStart: isoToTime(flight.arrivalTime),
          timeEnd: null,
          type: "flight_arrival",
          notes: joinNotes(flight.flightNumber, flight.arrivalAirport),
        })
      }
    }
  }
```

- [ ] **Step 3: Update car rental activity creation logic**

Replace lines 223-284 (car pickup and car return blocks) with:

```ts
  const carRentals = normalizeCarRentals(trip.carRental)

  for (let j = 0; j < carRentals.length; j++) {
    const rental = carRentals[j]

    // === Car pickup ===
    if (rental.company || rental.pickupLocation) {
      let pickupDateStr: string
      let pickupTimeStart: string | null = null

      if (rental.pickupTime) {
        pickupDateStr = isoToDateStr(rental.pickupTime)
        pickupTimeStart = isoToTime(rental.pickupTime)
      } else if ((flights.length === 0 || flights.length === 2) && flights[0]?.arrivalTime) {
        // Legacy fallback: use first flight arrival (only for old outbound/return pattern)
        pickupDateStr = isoToDateStr(flights[0].arrivalTime)
        pickupTimeStart = isoToTime(flights[0].arrivalTime)
      } else {
        const sd = trip.startDate
        pickupDateStr = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}-${String(sd.getDate()).padStart(2, "0")}`
      }

      const dayPlanId = dayPlanByDate.get(pickupDateStr)
      if (dayPlanId) {
        activitiesToCreate.push({
          dayPlanId,
          sortOrder: 500 + j * 10,
          timeStart: pickupTimeStart,
          timeEnd: pickupTimeStart !== null
            ? addMinutes(pickupTimeStart, carPickupDurationMinutes)
            : null,
          type: "car_pickup",
          notes: joinNotes(rental.company, rental.pickupLocation),
        })
      }
    }

    // === Car return ===
    if (rental.company || rental.returnLocation) {
      let returnDateStr: string
      let returnTimeStart: string | null = null

      if (rental.returnTime) {
        returnDateStr = isoToDateStr(rental.returnTime)
        returnTimeStart = isoToTime(rental.returnTime)
      } else if ((flights.length === 0 || flights.length === 2) && flights[flights.length - 1]?.departureTime) {
        // Legacy fallback: use last flight departure (only for old outbound/return pattern)
        const lastFlight = flights[flights.length - 1]
        returnDateStr = isoToDateStr(lastFlight.departureTime!)
        const depTime = isoToTime(lastFlight.departureTime!)
        returnTimeStart = subtractMinutes(depTime, preFlightArrivalMinutes + carReturnDurationMinutes)
      } else {
        const ed = trip.endDate
        returnDateStr = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, "0")}-${String(ed.getDate()).padStart(2, "0")}`
      }

      const dayPlanId = dayPlanByDate.get(returnDateStr)
      if (dayPlanId) {
        activitiesToCreate.push({
          dayPlanId,
          sortOrder: 500 + j * 10 + 1,
          timeStart: returnTimeStart,
          timeEnd: returnTimeStart !== null
            ? addMinutes(returnTimeStart, carReturnDurationMinutes)
            : null,
          type: "car_return",
          notes: joinNotes(rental.company, rental.returnLocation),
        })
      }
    }
  }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep sync-logistics`
Expected: No errors for sync-logistics.ts

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync-logistics.ts
git commit -m "feat: update sync-logistics to iterate over flight/carRental arrays"
```

---

## Task 5: Update API Routes for Array Format

**Files:**
- Modify: `src/app/api/trips/route.ts` (POST handler)
- Modify: `src/app/api/trips/[tripId]/route.ts` (PUT handler)

- [ ] **Step 1: Update POST /api/trips to accept array format**

In `src/app/api/trips/route.ts`, the create handler already passes `flights` and `carRental` directly from the request body to Prisma as JSON fields. Since Prisma stores them as JSON, no change is needed for the storage — arrays will be stored as-is.

Verify this by reading the file. The existing code at the relevant section should look like:
```ts
flights,
carRental,
```
If it passes through directly, no change needed.

- [ ] **Step 2: Update PUT /api/trips/:id to normalize on read**

In `src/app/api/trips/[tripId]/route.ts`, add normalizer imports at the top:

```ts
import { normalizeFlights, normalizeCarRentals } from "@/lib/normalizers"
```

No changes needed to the PUT handler itself — it already passes `flights` and `carRental` through to Prisma. The normalizers are used on the read side (GET handler and consumers).

- [ ] **Step 3: Update GET handler to normalize output**

In the GET handler of `src/app/api/trips/[tripId]/route.ts`, after fetching `fullTrip`, normalize the output:

```ts
  const normalized = {
    ...fullTrip,
    flights: normalizeFlights(fullTrip!.flights),
    carRental: normalizeCarRentals(fullTrip!.carRental),
  }

  return NextResponse.json(normalized)
```

This ensures all consumers get the new array format regardless of what's stored in the DB.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/trips/route.ts src/app/api/trips/[tripId]/route.ts
git commit -m "feat: normalize flights/carRental to arrays in API responses"
```

---

## Task 6: Update Export and Shared View

**Files:**
- Modify: `src/lib/export-docx.ts:27-56, 163-256`
- Modify: `src/app/shared/[token]/page.tsx:189-272`

- [ ] **Step 1: Update `TripData` interface in export-docx.ts**

Replace the `flights` and `carRental` fields in the `TripData` interface (lines 40-49) with:

```ts
  flights: Array<{
    flightNumber?: string
    departureAirport?: string
    departureTime?: string
    arrivalAirport?: string
    arrivalTime?: string
  }> | null
  carRental: Array<{
    company?: string
    pickupLocation?: string
    pickupTime?: string
    returnLocation?: string
    returnTime?: string
    additionalDetails?: string
  }> | null
```

- [ ] **Step 2: Update `buildFlightSection` in export-docx.ts**

Replace the function (lines 163-219) with:

```ts
function buildFlightSection(flights: TripData["flights"]): Paragraph[] {
  if (!flights || flights.length === 0) return []
  const paragraphs: Paragraph[] = [createHeading("טיסות", HeadingLevel.HEADING_2)]

  for (const flight of flights) {
    if (!flight.flightNumber && !flight.departureAirport) continue

    if (flight.flightNumber) {
      paragraphs.push(createInfoParagraph("מספר טיסה", flight.flightNumber))
    }
    if (flight.departureAirport) {
      paragraphs.push(
        createInfoParagraph(
          "יציאה",
          `${flight.departureAirport}${flight.departureTime ? ` - ${formatDateTime(flight.departureTime)}` : ""}`
        )
      )
    }
    if (flight.arrivalAirport) {
      paragraphs.push(
        createInfoParagraph(
          "נחיתה",
          `${flight.arrivalAirport}${flight.arrivalTime ? ` - ${formatDateTime(flight.arrivalTime)}` : ""}`
        )
      )
    }
    paragraphs.push(new Paragraph({ text: "" }))
  }

  return paragraphs
}
```

- [ ] **Step 3: Update `buildCarRentalSection` in export-docx.ts**

Replace the function (lines 245-256) with:

```ts
function buildCarRentalSection(carRentals: TripData["carRental"]): Paragraph[] {
  if (!carRentals || carRentals.length === 0) return []
  const paragraphs: Paragraph[] = [createHeading("השכרת רכב", HeadingLevel.HEADING_2)]

  for (const car of carRentals) {
    if (!car.company && !car.pickupLocation) continue

    if (car.company) paragraphs.push(createInfoParagraph("חברה", car.company))
    if (car.pickupLocation) paragraphs.push(createInfoParagraph("מיקום איסוף", car.pickupLocation))
    if (car.pickupTime) paragraphs.push(createInfoParagraph("זמן איסוף", formatDateTime(car.pickupTime)))
    if (car.returnLocation) paragraphs.push(createInfoParagraph("מיקום החזרה", car.returnLocation))
    if (car.returnTime) paragraphs.push(createInfoParagraph("זמן החזרה", formatDateTime(car.returnTime)))
    if (car.additionalDetails) paragraphs.push(createInfoParagraph("פרטים נוספים", car.additionalDetails))
    paragraphs.push(new Paragraph({ text: "" }))
  }

  return paragraphs
}
```

- [ ] **Step 4: Update shared trip view**

In `src/app/shared/[token]/page.tsx`, replace the flights section (lines 189-237) with a loop over the array. Also replace the car rental section (lines 264-272) with a loop. Use `normalizeFlights` and `normalizeCarRentals` imports.

Add at top of file:
```ts
import { normalizeFlights, normalizeCarRentals } from "@/lib/normalizers"
```

Replace flights JSX with:
```tsx
{(() => {
  const flightsList = normalizeFlights(trip.flights)
  return flightsList.length > 0 && (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">טיסות</h2>
      <div className="flex flex-col gap-4">
        {flightsList.map((flight, idx) => (
          <div key={idx}>
            {flight.flightNumber && <InfoRow label="מספר טיסה" value={flight.flightNumber} />}
            {flight.departureAirport && (
              <InfoRow
                label="יציאה"
                value={`${flight.departureAirport}${flight.departureTime ? ` - ${formatDateTime(flight.departureTime)}` : ""}`}
              />
            )}
            {flight.arrivalAirport && (
              <InfoRow
                label="נחיתה"
                value={`${flight.arrivalAirport}${flight.arrivalTime ? ` - ${formatDateTime(flight.arrivalTime)}` : ""}`}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  )
})()}
```

Replace car rental JSX (lines 264-272) with:

```tsx
{(() => {
  const rentalsList = normalizeCarRentals(trip.carRental)
  return rentalsList.length > 0 && (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">השכרת רכב</h2>
      {rentalsList.map((car, idx) => (
        <div key={idx} className={idx > 0 ? "mt-3 border-t border-zinc-100 pt-3" : ""}>
          {car.company && <InfoRow label="חברה" value={car.company} />}
          {car.pickupLocation && <InfoRow label="מיקום איסוף" value={car.pickupLocation} />}
          {car.pickupTime && <InfoRow label="זמן איסוף" value={formatDateTime(car.pickupTime)} />}
          {car.returnLocation && <InfoRow label="מיקום החזרה" value={car.returnLocation} />}
          {car.returnTime && <InfoRow label="זמן החזרה" value={formatDateTime(car.returnTime)} />}
          {car.additionalDetails && <InfoRow label="פרטים נוספים" value={car.additionalDetails} />}
        </div>
      ))}
    </section>
  )
})()}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/lib/export-docx.ts src/app/shared/[token]/page.tsx
git commit -m "feat: update export and shared view for array-based flights/carRentals"
```

---

## Task 7: Shared UI Components — List Editors

**Files:**
- Create: `src/components/trips/InputField.tsx` (shared input component)
- Create: `src/components/trips/AccommodationsList.tsx`
- Create: `src/components/trips/FlightsList.tsx`
- Create: `src/components/trips/CarRentalsList.tsx`

**Note:** All three list components use the same `InputField` component. Extract it to a shared file to avoid duplication:

```tsx
// src/components/trips/InputField.tsx
"use client"

export function InputField({
  label,
  type = "text",
  value,
  onChange,
  required = false,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
      />
    </label>
  )
}
```

All list editors should `import { InputField } from "./InputField"` instead of defining their own.

- [ ] **Step 1: Create AccommodationsList component**

Extract the accommodation editing UI from TripForm into a reusable component. Reference the existing TripForm code (lines 183-214) for the current UI pattern.

```tsx
// src/components/trips/AccommodationsList.tsx
"use client"

import { InputField } from "./InputField"

interface AccommodationFormData {
  _id: number
  name: string
  address: string
  checkIn: string
  checkOut: string
  contact: string
  bookingReference: string
}

interface AccommodationsListProps {
  items: AccommodationFormData[]
  onChange: (items: AccommodationFormData[]) => void
}

let _nextId = 1
export function makeEmptyAccommodation(): AccommodationFormData {
  return { _id: _nextId++, name: "", address: "", checkIn: "", checkOut: "", contact: "", bookingReference: "" }
}

export function AccommodationsList({ items, onChange }: AccommodationsListProps) {
  const updateItem = (idx: number, field: keyof AccommodationFormData, value: string) => {
    onChange(items.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((acc, idx) => (
        <div key={acc._id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-600 relative">
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="absolute top-2 left-2 text-zinc-400 hover:text-red-500 text-lg leading-none"
            >
              ×
            </button>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="שם" value={acc.name} onChange={(v) => updateItem(idx, "name", v)} />
            <InputField label="כתובת" value={acc.address} onChange={(v) => updateItem(idx, "address", v)} />
            <InputField label="צ'ק-אין" type="datetime-local" value={acc.checkIn} onChange={(v) => updateItem(idx, "checkIn", v)} />
            <InputField label="צ'ק-אאוט" type="datetime-local" value={acc.checkOut} onChange={(v) => updateItem(idx, "checkOut", v)} />
            <InputField label="פרטי קשר" value={acc.contact} onChange={(v) => updateItem(idx, "contact", v)} />
            <InputField label="מספר הזמנה" value={acc.bookingReference} onChange={(v) => updateItem(idx, "bookingReference", v)} />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, makeEmptyAccommodation()])}
        className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400"
      >
        + הוסף לינה
      </button>
    </div>
  )
}

export type { AccommodationFormData }
```

- [ ] **Step 2: Create FlightsList component**

```tsx
// src/components/trips/FlightsList.tsx
"use client"

import { InputField } from "./InputField"

interface FlightFormData {
  _id: number
  flightNumber: string
  departureAirport: string
  departureTime: string
  arrivalAirport: string
  arrivalTime: string
}

interface FlightsListProps {
  items: FlightFormData[]
  onChange: (items: FlightFormData[]) => void
}

let _nextFlightId = 1
export function makeEmptyFlight(): FlightFormData {
  return { _id: _nextFlightId++, flightNumber: "", departureAirport: "", departureTime: "", arrivalAirport: "", arrivalTime: "" }
}

export function FlightsList({ items, onChange }: FlightsListProps) {
  const updateItem = (idx: number, field: keyof FlightFormData, value: string) => {
    onChange(items.map((f, i) => i === idx ? { ...f, [field]: value } : f))
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((flight, idx) => (
        <div key={flight._id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-600 relative">
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="absolute top-2 left-2 text-zinc-400 hover:text-red-500 text-lg leading-none"
            >
              ×
            </button>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="מספר טיסה" value={flight.flightNumber} onChange={(v) => updateItem(idx, "flightNumber", v)} />
            <div />
            <InputField label="שדה תעופה - יציאה" value={flight.departureAirport} onChange={(v) => updateItem(idx, "departureAirport", v)} />
            <InputField label="שעת יציאה" type="datetime-local" value={flight.departureTime} onChange={(v) => updateItem(idx, "departureTime", v)} />
            <InputField label="שדה תעופה - נחיתה" value={flight.arrivalAirport} onChange={(v) => updateItem(idx, "arrivalAirport", v)} />
            <InputField label="שעת נחיתה" type="datetime-local" value={flight.arrivalTime} onChange={(v) => updateItem(idx, "arrivalTime", v)} />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, makeEmptyFlight()])}
        className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400"
      >
        + הוסף טיסה
      </button>
    </div>
  )
}

export type { FlightFormData }
```

- [ ] **Step 3: Create CarRentalsList component**

```tsx
// src/components/trips/CarRentalsList.tsx
"use client"

import { InputField } from "./InputField"

interface CarRentalFormData {
  _id: number
  company: string
  pickupLocation: string
  pickupTime: string
  returnLocation: string
  returnTime: string
  additionalDetails: string
}

interface CarRentalsListProps {
  items: CarRentalFormData[]
  onChange: (items: CarRentalFormData[]) => void
}

let _nextRentalId = 1
export function makeEmptyCarRental(): CarRentalFormData {
  return { _id: _nextRentalId++, company: "", pickupLocation: "", pickupTime: "", returnLocation: "", returnTime: "", additionalDetails: "" }
}

export function CarRentalsList({ items, onChange }: CarRentalsListProps) {
  const updateItem = (idx: number, field: keyof CarRentalFormData, value: string) => {
    onChange(items.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((rental, idx) => (
        <div key={rental._id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-600 relative">
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              className="absolute top-2 left-2 text-zinc-400 hover:text-red-500 text-lg leading-none"
            >
              ×
            </button>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="חברה" value={rental.company} onChange={(v) => updateItem(idx, "company", v)} />
            <div />
            <InputField label="מיקום איסוף" value={rental.pickupLocation} onChange={(v) => updateItem(idx, "pickupLocation", v)} />
            <InputField label="זמן איסוף" type="datetime-local" value={rental.pickupTime} onChange={(v) => updateItem(idx, "pickupTime", v)} />
            <InputField label="מיקום החזרה" value={rental.returnLocation} onChange={(v) => updateItem(idx, "returnLocation", v)} />
            <InputField label="זמן החזרה" type="datetime-local" value={rental.returnTime} onChange={(v) => updateItem(idx, "returnTime", v)} />
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">פרטים נוספים</span>
              <textarea
                value={rental.additionalDetails}
                onChange={(e) => updateItem(idx, "additionalDetails", e.target.value)}
                rows={2}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, makeEmptyCarRental()])}
        className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400"
      >
        + הוסף השכרת רכב
      </button>
    </div>
  )
}

export type { CarRentalFormData }
```

- [ ] **Step 4: Commit**

```bash
git add src/components/trips/AccommodationsList.tsx src/components/trips/FlightsList.tsx src/components/trips/CarRentalsList.tsx
git commit -m "feat: add reusable list editor components for flights, accommodations, car rentals"
```

---

## Task 8: FileUploadZone Component

**Files:**
- Create: `src/components/trips/FileUploadZone.tsx`

- [ ] **Step 1: Create FileUploadZone component**

This component handles drag-and-drop file upload and extraction. It calls the standalone `/api/extract` endpoint and returns extracted data to the parent.

```tsx
// src/components/trips/FileUploadZone.tsx
"use client"

import { useState, useRef, useCallback } from "react"
import type { ExtractedTripDetails } from "@/lib/gemini"

interface FileUploadZoneProps {
  /** Optional tripId — if provided, uses /api/trips/:id/extract; otherwise /api/extract */
  tripId?: string
  onExtracted: (data: ExtractedTripDetails, fileName: string) => void
}

export function FileUploadZone({ tripId, onExtracted }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
      if (!allowedTypes.includes(file.type)) {
        setError("סוג קובץ לא נתמך. ניתן להעלות PDF, JPG או PNG.")
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("הקובץ גדול מדי. מקסימום 10MB.")
        return
      }

      setFileName(file.name)
      setIsExtracting(true)

      try {
        const formData = new FormData()
        formData.append("file", file)

        const url = tripId ? `/api/trips/${tripId}/extract` : "/api/extract"
        const res = await fetch(url, { method: "POST", body: formData })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "שגיאה בחילוץ פרטים")
        }

        const data: ExtractedTripDetails = await res.json()
        onExtracted(data, file.name)
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה בחילוץ פרטים מהקובץ")
      } finally {
        setIsExtracting(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [tripId, onExtracted]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
            : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800/50 dark:hover:border-zinc-500"
        }`}
      >
        {isExtracting ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
            <p className="text-sm text-zinc-500">מנתח את הקובץ {fileName ? `(${fileName})` : ""}...</p>
          </>
        ) : (
          <>
            <svg className="h-10 w-10 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm text-zinc-500">גרור קובץ לכאן או לחץ לבחירה</p>
            <p className="text-xs text-zinc-400">PDF, JPG, PNG (עד 10MB)</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/trips/FileUploadZone.tsx
git commit -m "feat: add FileUploadZone component for drag-and-drop file extraction"
```

---

## Task 9: MergeReview Component

**Files:**
- Create: `src/components/trips/MergeReview.tsx`

- [ ] **Step 1: Create MergeReview component**

This component shows existing + newly extracted items with checkboxes per category.

```tsx
// src/components/trips/MergeReview.tsx
"use client"

import { useState, useCallback } from "react"

interface MergeItem<T> {
  data: T
  source: "existing" | "new"
  checked: boolean
}

interface MergeCategoryProps<T> {
  title: string
  items: MergeItem<T>[]
  renderItem: (item: T) => React.ReactNode
  onToggle: (index: number) => void
}

function MergeCategory<T>({ title, items, renderItem, onToggle }: MergeCategoryProps<T>) {
  if (items.length === 0) return null

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <div className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <label key={idx} className="flex items-start gap-3 cursor-pointer rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => onToggle(idx)}
              className="mt-1 h-4 w-4 rounded border-zinc-300"
            />
            <div className="flex-1">
              <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium mb-1 ${
                item.source === "existing"
                  ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              }`}>
                {item.source === "existing" ? "קיים" : "חדש"}
              </span>
              {renderItem(item.data)}
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// Render helpers for each data type
function renderFlight(f: Record<string, unknown>) {
  const parts = [f.flightNumber, [f.departureAirport, f.arrivalAirport].filter(Boolean).join(" → ")]
    .filter(Boolean)
  return <span className="text-sm">{parts.join(" | ")}</span>
}

function renderAccommodation(a: Record<string, unknown>) {
  const parts = [a.name, a.address].filter(Boolean)
  return <span className="text-sm">{parts.join(" - ")}</span>
}

function renderCarRental(c: Record<string, unknown>) {
  const parts = [c.company, c.pickupLocation].filter(Boolean)
  return <span className="text-sm">{parts.join(" - ")}</span>
}

interface MergeReviewProps {
  existingFlights: Record<string, unknown>[]
  newFlights: Record<string, unknown>[]
  existingAccommodation: Record<string, unknown>[]
  newAccommodation: Record<string, unknown>[]
  existingCarRentals: Record<string, unknown>[]
  newCarRentals: Record<string, unknown>[]
  onConfirm: (result: {
    flights: Record<string, unknown>[]
    accommodation: Record<string, unknown>[]
    carRental: Record<string, unknown>[]
  }) => void
  onCancel: () => void
  isSaving?: boolean
}

export function MergeReview({
  existingFlights, newFlights,
  existingAccommodation, newAccommodation,
  existingCarRentals, newCarRentals,
  onConfirm, onCancel, isSaving,
}: MergeReviewProps) {
  const buildItems = <T,>(existing: T[], newItems: T[]): MergeItem<T>[] => [
    ...existing.map((data) => ({ data, source: "existing" as const, checked: true })),
    ...newItems.map((data) => ({ data, source: "new" as const, checked: true })),
  ]

  const [flights, setFlights] = useState(() => buildItems(existingFlights, newFlights))
  const [accommodation, setAccommodation] = useState(() => buildItems(existingAccommodation, newAccommodation))
  const [carRentals, setCarRentals] = useState(() => buildItems(existingCarRentals, newCarRentals))

  const toggle = <T,>(items: MergeItem<T>[], setItems: (items: MergeItem<T>[]) => void) =>
    (idx: number) => setItems(items.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item))

  const handleConfirm = useCallback(() => {
    onConfirm({
      flights: flights.filter((i) => i.checked).map((i) => i.data) as Record<string, unknown>[],
      accommodation: accommodation.filter((i) => i.checked).map((i) => i.data) as Record<string, unknown>[],
      carRental: carRentals.filter((i) => i.checked).map((i) => i.data) as Record<string, unknown>[],
    })
  }, [flights, accommodation, carRentals, onConfirm])

  const hasContent = flights.length > 0 || accommodation.length > 0 || carRentals.length > 0

  if (!hasContent) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
        נמצאו פרטים חדשים. בחר מה לשמור:
      </div>

      <MergeCategory title="טיסות" items={flights} renderItem={renderFlight} onToggle={toggle(flights, setFlights)} />
      <MergeCategory title="לינה" items={accommodation} renderItem={renderAccommodation} onToggle={toggle(accommodation, setAccommodation)} />
      <MergeCategory title="השכרת רכב" items={carRentals} renderItem={renderCarRental} onToggle={toggle(carRentals, setCarRentals)} />

      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={isSaving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "שומר..." : "אשר ושמור"}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          ביטול
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/trips/MergeReview.tsx
git commit -m "feat: add MergeReview component for per-item merge UI"
```

---

## Task 10: Rewrite TripForm with File Upload

**Files:**
- Modify: `src/components/trips/TripForm.tsx`

- [ ] **Step 1: Rewrite TripForm**

Replace the entire `TripForm.tsx` with the new layout: basic info → upload zone → collapsible detail sections. Import and use the shared list editor components.

**Implementation reference:** The existing `TripForm.tsx` (read it first) has `CollapsibleSection` and `InputField` components to reuse. The new version replaces all individual flight/car state variables with array state.

**State:**
```tsx
import { FileUploadZone } from "./FileUploadZone"
import { FlightsList, makeEmptyFlight, type FlightFormData } from "./FlightsList"
import { AccommodationsList, makeEmptyAccommodation, type AccommodationFormData } from "./AccommodationsList"
import { CarRentalsList, makeEmptyCarRental, type CarRentalFormData } from "./CarRentalsList"
import { InputField } from "./InputField"
import type { ExtractedTripDetails } from "@/lib/gemini"

// State
const [name, setName] = useState("")
const [destination, setDestination] = useState("")
const [startDate, setStartDate] = useState("")
const [endDate, setEndDate] = useState("")
const [flights, setFlights] = useState<FlightFormData[]>([makeEmptyFlight()])
const [accommodations, setAccommodations] = useState<AccommodationFormData[]>([makeEmptyAccommodation()])
const [carRentals, setCarRentals] = useState<CarRentalFormData[]>([makeEmptyCarRental()])
const [showFlights, setShowFlights] = useState(false)
const [showAccommodation, setShowAccommodation] = useState(false)
const [showCarRentals, setShowCarRentals] = useState(false)
```

**Extraction handler:**
```tsx
const handleExtracted = useCallback((data: ExtractedTripDetails) => {
  if (data.destination && !destination) setDestination(data.destination)
  if (data.startDate && !startDate) setStartDate(data.startDate)
  if (data.endDate && !endDate) setEndDate(data.endDate)

  if (data.flights && data.flights.length > 0) {
    let nextId = Date.now()
    const newFlights = data.flights.map(f => ({
      _id: nextId++,
      flightNumber: f.flightNumber || "",
      departureAirport: f.departureAirport || "",
      departureTime: f.departureTime || "",
      arrivalAirport: f.arrivalAirport || "",
      arrivalTime: f.arrivalTime || "",
    }))
    setFlights(prev => {
      const nonEmpty = prev.filter(f => f.flightNumber || f.departureAirport || f.arrivalAirport)
      return nonEmpty.length > 0 ? [...nonEmpty, ...newFlights] : newFlights
    })
    setShowFlights(true)
  }

  // Same pattern for accommodation and carRentals...
  // (mirror the flights logic for each category)
}, [destination, startDate, endDate])
```

**Submit handler:**
```tsx
const flightsData = flights
  .filter(f => f.flightNumber || f.departureAirport || f.arrivalAirport)
  .map(({ _id, ...rest }) => rest)

const carRentalData = carRentals
  .filter(r => r.company || r.pickupLocation || r.returnLocation)
  .map(({ _id, ...rest }) => rest)

const accommodationData = accommodations
  .filter(a => a.name || a.address || a.checkIn || a.checkOut)
  .map(({ _id, ...rest }) => rest)
```

**JSX layout order:**
1. Basic info section (name, destination, dates) — same as current
2. `<FileUploadZone onExtracted={handleExtracted} />` — new, below basic info
3. `<CollapsibleSection title="טיסות" open={showFlights}>` → `<FlightsList items={flights} onChange={setFlights} />`
4. `<CollapsibleSection title="לינה" open={showAccommodation}>` → `<AccommodationsList items={accommodations} onChange={setAccommodations} />`
5. `<CollapsibleSection title="השכרת רכב" open={showCarRentals}>` → `<CarRentalsList items={carRentals} onChange={setCarRentals} />`
6. Submit button

**Note:** `CollapsibleSection` needs to be updated to accept a controlled `open` prop alongside its internal toggle. Add `open` and `onToggle` props.

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev` and navigate to `/trips/new`
Expected: Page shows basic info, upload zone, and collapsible sections

- [ ] **Step 3: Commit**

```bash
git add src/components/trips/TripForm.tsx
git commit -m "feat: rewrite TripForm with file upload zone and array-based list editors"
```

---

## Task 11: Update TripDashboard with Merge UI

**Files:**
- Modify: `src/components/trips/TripDashboard.tsx`
- Delete: `src/components/trips/FileUploadExtractor.tsx`

- [ ] **Step 1: Read current TripDashboard to understand the integration point**

Read `src/components/trips/TripDashboard.tsx` fully to find where `FileUploadExtractor` is used and how the dashboard displays logistics data.

- [ ] **Step 2: Replace FileUploadExtractor with FileUploadZone + MergeReview**

**Imports to add:**
```tsx
import { FileUploadZone } from "./FileUploadZone"
import { MergeReview } from "./MergeReview"
import { FlightsList, makeEmptyFlight, type FlightFormData } from "./FlightsList"
import { AccommodationsList, makeEmptyAccommodation, type AccommodationFormData } from "./AccommodationsList"
import { CarRentalsList, makeEmptyCarRental, type CarRentalFormData } from "./CarRentalsList"
import { normalizeFlights, normalizeCarRentals } from "@/lib/normalizers"
import type { ExtractedTripDetails } from "@/lib/gemini"
```

**Remove:** `FileUploadExtractor` import and its usage in JSX.

**State to add:**
```tsx
const [mergeData, setMergeData] = useState<ExtractedTripDetails | null>(null)
const [isSavingMerge, setIsSavingMerge] = useState(false)
```

**Extraction handler:**
```tsx
const handleExtracted = useCallback((data: ExtractedTripDetails) => {
  const existingFlights = normalizeFlights(trip.flights)
  const existingAccommodation = normalizeAccommodations(trip.accommodation)
  const existingCarRentals = normalizeCarRentals(trip.carRental)

  const hasExistingOverlap =
    (existingFlights.length > 0 && data.flights && data.flights.length > 0) ||
    (existingAccommodation.length > 0 && data.accommodation && data.accommodation.length > 0) ||
    (existingCarRentals.length > 0 && data.carRental && data.carRental.length > 0)

  if (hasExistingOverlap) {
    setMergeData(data) // show merge UI
  } else {
    // No overlap — directly save
    const body: Record<string, unknown> = {}
    if (data.flights?.length) body.flights = [...existingFlights, ...data.flights]
    if (data.accommodation?.length) body.accommodation = [...existingAccommodation, ...data.accommodation]
    if (data.carRental?.length) body.carRental = [...existingCarRentals, ...data.carRental]
    saveTripUpdate(body)
  }
}, [trip])
```

**Merge confirm handler:**
```tsx
const handleMergeConfirm = useCallback(async (result: { flights: ..., accommodation: ..., carRental: ... }) => {
  setIsSavingMerge(true)
  try {
    await fetch(`/api/trips/${trip.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    })
    setMergeData(null)
    handleRefresh() // existing refresh function
  } finally {
    setIsSavingMerge(false)
  }
}, [trip.id])
```

**JSX:** Replace the `<FileUploadExtractor>` with:
```tsx
<FileUploadZone tripId={trip.id} onExtracted={handleExtracted} />
{mergeData && (
  <MergeReview
    existingFlights={normalizeFlights(trip.flights)}
    newFlights={mergeData.flights || []}
    existingAccommodation={normalizeAccommodations(trip.accommodation)}
    newAccommodation={mergeData.accommodation || []}
    existingCarRentals={normalizeCarRentals(trip.carRental)}
    newCarRentals={mergeData.carRental || []}
    onConfirm={handleMergeConfirm}
    onCancel={() => setMergeData(null)}
    isSaving={isSavingMerge}
  />
)}
```

- [ ] **Step 3: Add editable detail sections to dashboard**

Below the upload zone and merge UI, add collapsible sections with `FlightsList`, `AccommodationsList`, `CarRentalsList` populated from trip data. These sections allow manual editing of logistics data.

**Implementation:** Convert trip data to form format on load, track with state. Add a "Save changes" button that appears when data has been modified. On save, call `PUT /api/trips/:id` with updated data and refresh.

```tsx
// Initialize form data from trip
const [editFlights, setEditFlights] = useState<FlightFormData[]>(() => {
  const normalized = normalizeFlights(trip.flights)
  if (normalized.length === 0) return [makeEmptyFlight()]
  let id = Date.now()
  return normalized.map(f => ({
    _id: id++,
    flightNumber: f.flightNumber || "",
    departureAirport: f.departureAirport || "",
    departureTime: f.departureTime || "",
    arrivalAirport: f.arrivalAirport || "",
    arrivalTime: f.arrivalTime || "",
  }))
})
// Same pattern for accommodations and carRentals
```

When the user edits and saves, call `PUT /api/trips/:id` with updated data and trigger refresh/sync.

- [ ] **Step 4: Delete FileUploadExtractor.tsx**

```bash
git rm src/components/trips/FileUploadExtractor.tsx
```

- [ ] **Step 5: Verify the dashboard renders and works**

Run: `npm run dev` and navigate to an existing trip
Expected: Upload zone visible, sections show existing data, merge UI appears on upload

- [ ] **Step 6: Commit**

```bash
git add src/components/trips/TripDashboard.tsx
git add -u src/components/trips/FileUploadExtractor.tsx
git commit -m "feat: replace FileUploadExtractor with FileUploadZone + MergeReview in dashboard"
```

---

## Task 12: Verify Full Integration

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run existing tests**

Run: `npx jest --verbose`
Expected: All tests pass (normalizers + existing driving-times tests)

- [ ] **Step 3: Run dev server and test new trip creation flow**

1. Navigate to `/trips/new`
2. Upload a flight confirmation PDF/image
3. Verify extracted data populates the form
4. Manually edit a field
5. Click "Create Trip"
6. Verify trip is created with all data

- [ ] **Step 4: Test merge flow on existing trip**

1. Navigate to an existing trip dashboard
2. Upload a new document
3. Verify merge UI shows existing + new items
4. Uncheck an item, confirm
5. Verify the data is updated correctly
6. Verify the schedule/itinerary synced

- [ ] **Step 5: Test manual editing on existing trip**

1. Edit flights manually on the dashboard
2. Save
3. Verify itinerary updated

- [ ] **Step 6: Test export and shared view**

1. Export a trip with multiple flights to DOCX
2. Open a shared trip link
3. Verify both show all flights and car rentals correctly

- [ ] **Step 7: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes for file upload and multi-logistics"
```
