# Multiple Accommodations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support multiple accommodations per trip with automatic accommodation badges on itinerary days.

**Architecture:** Change the `accommodation` JSON field from a single object to an array. Update all consumers (APIs, forms, dashboard, schedule, export, extraction, map) to handle arrays. Add a date-matching utility to compute which accommodation covers each day.

**Tech Stack:** Next.js, Prisma (JSON field), React, TypeScript, docx library

---

### Task 1: Add accommodation helper type and date-matching utility

**Files:**
- Create: `src/lib/accommodations.ts`

**Step 1: Create the utility file**

```ts
export interface Accommodation {
  name?: string
  address?: string
  checkIn?: string
  checkOut?: string
  contact?: string
  bookingReference?: string
  coordinates?: { lat: number; lng: number }
}

export type AccommodationStatus = "check-in" | "check-out" | "staying" | null

/**
 * Given an array of accommodations and a day's date string (YYYY-MM-DD),
 * returns the accommodations relevant to that day with their status.
 */
export function getAccommodationsForDay(
  accommodations: Accommodation[],
  dayDate: string
): Array<{ accommodation: Accommodation; status: "check-in" | "check-out" | "staying" }> {
  const day = new Date(dayDate)
  day.setHours(0, 0, 0, 0)
  const results: Array<{ accommodation: Accommodation; status: "check-in" | "check-out" | "staying" }> = []

  for (const acc of accommodations) {
    if (!acc.checkIn && !acc.checkOut) continue

    const checkIn = acc.checkIn ? new Date(acc.checkIn) : null
    const checkOut = acc.checkOut ? new Date(acc.checkOut) : null

    const checkInDate = checkIn ? new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate()) : null
    const checkOutDate = checkOut ? new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate()) : null

    if (checkInDate && day.getTime() === checkInDate.getTime()) {
      results.push({ accommodation: acc, status: "check-in" })
    } else if (checkOutDate && day.getTime() === checkOutDate.getTime()) {
      results.push({ accommodation: acc, status: "check-out" })
    } else if (checkInDate && checkOutDate && day > checkInDate && day < checkOutDate) {
      results.push({ accommodation: acc, status: "staying" })
    }
  }

  return results
}

/**
 * Normalize accommodation data — wraps a single object in an array,
 * handles null/undefined, filters empty entries.
 */
export function normalizeAccommodations(data: unknown): Accommodation[] {
  if (!data) return []
  if (Array.isArray(data)) return data.filter((a) => a && (a.name || a.address))
  if (typeof data === "object") {
    const obj = data as Accommodation
    if (obj.name || obj.address) return [obj]
  }
  return []
}
```

**Step 2: Commit**

```bash
git add src/lib/accommodations.ts
git commit -m "feat: add accommodation type and date-matching utility"
```

---

### Task 2: Update Trip creation API to handle accommodation array

**Files:**
- Modify: `src/app/api/trips/route.ts:28-67`

**Step 1: Update POST handler to geocode each accommodation in the array**

Replace the accommodation geocoding block (lines 44-51) and the data block. The key change: accept `accommodation` as either a single object or array, normalize to array, geocode each entry, store the array.

```ts
// In POST handler, after destructuring body:
import { normalizeAccommodations } from "@/lib/accommodations"

// Replace lines 44-60 with:
const accommodations = normalizeAccommodations(accommodation)
const enrichedAccommodations = await Promise.all(
  accommodations.map(async (acc) => {
    if (acc.address) {
      const coords = await geocodeAddress(acc.address)
      if (coords) return { ...acc, coordinates: coords }
    }
    return acc
  })
)

const trip = await prisma.trip.create({
  data: {
    userId: session.user.id,
    name,
    destination,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    accommodation: enrichedAccommodations.length > 0 ? enrichedAccommodations : undefined,
    flights: flights || undefined,
    carRental: carRental || undefined,
  },
})
```

**Step 2: Commit**

```bash
git add src/app/api/trips/route.ts
git commit -m "feat: handle accommodation array in trip creation API"
```

---

### Task 3: Update Trip update API to handle accommodation array

**Files:**
- Modify: `src/app/api/trips/[tripId]/route.ts:56-103`

**Step 1: Update PUT handler similarly to Task 2**

Replace accommodation geocoding block (lines 75-82):

```ts
import { normalizeAccommodations } from "@/lib/accommodations"

// Replace lines 75-82:
let enrichedAccommodation = accommodation
if (accommodation !== undefined) {
  const accommodations = normalizeAccommodations(accommodation)
  enrichedAccommodation = await Promise.all(
    accommodations.map(async (acc) => {
      if (acc.address) {
        const coords = await geocodeAddress(acc.address)
        if (coords) return { ...acc, coordinates: coords }
      }
      return acc
    })
  )
}
```

**Step 2: Commit**

```bash
git add src/app/api/trips/[tripId]/route.ts
git commit -m "feat: handle accommodation array in trip update API"
```

---

### Task 4: Update TripForm to support multiple accommodations

**Files:**
- Modify: `src/components/trips/TripForm.tsx`

**Step 1: Replace single accommodation state with array state**

Replace the single `accName/accAddress/...` state variables (lines 70-75) with:

```ts
interface AccommodationFormData {
  name: string
  address: string
  checkIn: string
  checkOut: string
  contact: string
  bookingReference: string
}

const emptyAccommodation: AccommodationFormData = {
  name: "", address: "", checkIn: "", checkOut: "", contact: "", bookingReference: ""
}

const [accommodations, setAccommodations] = useState<AccommodationFormData[]>([{ ...emptyAccommodation }])
```

**Step 2: Update handleSubmit to build array**

Replace lines 100-110:

```ts
const accommodationData = accommodations
  .filter((a) => a.name || a.address || a.checkIn || a.checkOut || a.contact || a.bookingReference)

// In the fetch body, send: accommodation: accommodationData.length > 0 ? accommodationData : undefined
```

**Step 3: Replace the accommodation form section (lines 178-188) with repeatable cards**

```tsx
<CollapsibleSection title="לינה">
  <div className="flex flex-col gap-4">
    {accommodations.map((acc, idx) => (
      <div key={idx} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-600 relative">
        {accommodations.length > 1 && (
          <button
            type="button"
            onClick={() => setAccommodations((prev) => prev.filter((_, i) => i !== idx))}
            className="absolute top-2 left-2 text-zinc-400 hover:text-red-500 text-lg"
          >
            ×
          </button>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="שם" value={acc.name} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, name: v } : a))} />
          <InputField label="כתובת" value={acc.address} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, address: v } : a))} />
          <InputField label="צ'ק-אין" type="datetime-local" value={acc.checkIn} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, checkIn: v } : a))} />
          <InputField label="צ'ק-אאוט" type="datetime-local" value={acc.checkOut} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, checkOut: v } : a))} />
          <InputField label="פרטי קשר" value={acc.contact} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, contact: v } : a))} />
          <InputField label="מספר הזמנה" value={acc.bookingReference} onChange={(v) => setAccommodations((prev) => prev.map((a, i) => i === idx ? { ...a, bookingReference: v } : a))} />
        </div>
      </div>
    ))}
    <button
      type="button"
      onClick={() => setAccommodations((prev) => [...prev, { ...emptyAccommodation }])}
      className="self-start rounded-lg border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400"
    >
      + הוסף לינה
    </button>
  </div>
</CollapsibleSection>
```

**Step 4: Commit**

```bash
git add src/components/trips/TripForm.tsx
git commit -m "feat: support multiple accommodations in trip creation form"
```

---

### Task 5: Update TripDashboard Trip interface and OverviewTab

**Files:**
- Modify: `src/components/trips/TripDashboard.tsx`

**Step 1: Update the Trip interface (lines 21-29)**

Change `accommodation` from single object to array:

```ts
accommodation: Array<{
  name?: string
  address?: string
  checkIn?: string
  checkOut?: string
  contact?: string
  bookingReference?: string
  coordinates?: { lat: number; lng: number }
}> | null
```

**Step 2: Update OverviewTab to use `normalizeAccommodations` and display/edit multiple cards**

Import at top:
```ts
import { normalizeAccommodations } from "@/lib/accommodations"
```

In `OverviewTab` (line 121+):
- Replace `const acc = trip.accommodation` with `const accommodations = normalizeAccommodations(trip.accommodation)`
- Replace `editAccommodation` state (line 147-154) with an array: `const [editAccommodations, setEditAccommodations] = useState(accommodations.map(...))`
- Update `handleStartEdit` to reset the array
- Update `handleSaveEdit` to send array
- Replace view-mode accommodation card (lines 327-339) to loop over accommodations
- Replace edit-mode accommodation section (lines 259-270) with repeatable cards + add button

**Step 3: Update map section (lines 415-425)**

Use first accommodation with coordinates as map center:
```ts
const mapCenter = accommodations.find((a) => a.coordinates)?.coordinates
// ... pass mapCenter to TripMap
```

**Step 4: Commit**

```bash
git add src/components/trips/TripDashboard.tsx
git commit -m "feat: display and edit multiple accommodations in dashboard"
```

---

### Task 6: Add accommodation badges to ScheduleView

**Files:**
- Modify: `src/components/schedule/ScheduleView.tsx`

**Step 1: Update Trip interface in ScheduleView (lines 9-23)**

Add accommodation to the Trip interface:
```ts
interface Trip {
  id: string
  startDate: string
  endDate: string
  accommodation: unknown  // will be normalized
  flights: { ... } | null
  attractions: ...
  restaurants: ...
}
```

**Step 2: Add accommodation badge display to day tabs**

Import:
```ts
import { normalizeAccommodations, getAccommodationsForDay } from "@/lib/accommodations"
```

Inside the component, compute accommodations:
```ts
const accommodations = useMemo(() => normalizeAccommodations(trip.accommodation), [trip.accommodation])
```

In each day tab button (around line 200), after the weather display, add:
```tsx
{(() => {
  const dayAccs = getAccommodationsForDay(accommodations, day.date)
  if (dayAccs.length === 0) return null
  return dayAccs.map(({ accommodation: a, status }, i) => (
    <span key={i} className="text-[10px] text-blue-500 dark:text-blue-400">
      🏨 {status === "check-in" ? "כניסה: " : status === "check-out" ? "יציאה: " : ""}{a.name}
    </span>
  ))
})()}
```

**Step 3: Commit**

```bash
git add src/components/schedule/ScheduleView.tsx
git commit -m "feat: show accommodation badges on itinerary days"
```

---

### Task 7: Update DOCX export for multiple accommodations

**Files:**
- Modify: `src/lib/export-docx.ts:27-39,221-234`

**Step 1: Update TripData interface (lines 32-39)**

Change accommodation type to array:
```ts
accommodation: Array<{
  name?: string
  address?: string
  checkIn?: string
  checkOut?: string
  contact?: string
  bookingReference?: string
}> | null
```

**Step 2: Update `buildAccommodationSection` (lines 221-234)**

Change to iterate over array:
```ts
function buildAccommodationSection(accommodations: TripData["accommodation"]): Paragraph[] {
  const accs = (accommodations ?? []).filter((a) => a.name || a.address)
  if (accs.length === 0) return []
  const paragraphs: Paragraph[] = [createHeading("לינה", HeadingLevel.HEADING_2)]

  for (const acc of accs) {
    if (accs.length > 1 && acc.name) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: acc.name, bold: true, size: 22 })],
      }))
    }
    if (acc.name && accs.length === 1) paragraphs.push(createInfoParagraph("שם", acc.name))
    if (acc.address) paragraphs.push(createInfoParagraph("כתובת", acc.address))
    if (acc.checkIn) paragraphs.push(createInfoParagraph("צ'ק-אין", formatDateTime(acc.checkIn)))
    if (acc.checkOut) paragraphs.push(createInfoParagraph("צ'ק-אאוט", formatDateTime(acc.checkOut)))
    if (acc.contact) paragraphs.push(createInfoParagraph("פרטי קשר", acc.contact))
    if (acc.bookingReference) paragraphs.push(createInfoParagraph("מספר הזמנה", acc.bookingReference))
    paragraphs.push(new Paragraph({ text: "" }))
  }

  return paragraphs
}
```

**Step 3: Commit**

```bash
git add src/lib/export-docx.ts
git commit -m "feat: export multiple accommodations in DOCX"
```

---

### Task 8: Update Gemini extraction to support multiple accommodations

**Files:**
- Modify: `src/lib/gemini.ts:9-59`

**Step 1: Update `ExtractedTripDetails` interface (lines 26-33)**

Change to array:
```ts
accommodation: Array<{
  name?: string | null
  address?: string | null
  checkIn?: string | null
  checkOut?: string | null
  contact?: string | null
  bookingReference?: string | null
}> | null
```

**Step 2: Update `EXTRACTION_PROMPT` (lines 42-59)**

Change the accommodation part of the JSON template:
```
"accommodation": [{ "name": "...", "address": "...", "checkIn": "YYYY-MM-DDTHH:mm", "checkOut": "YYYY-MM-DDTHH:mm", "contact": "...", "bookingReference": "..." }],
```

Add a rule: `- accommodation הוא מערך. אם יש כמה בתי מלון או מקומות לינה, החזר כל אחד כאובייקט נפרד.`

**Step 3: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: extract multiple accommodations from documents"
```

---

### Task 9: Update FileUploadExtractor preview for multiple accommodations

**Files:**
- Modify: `src/components/trips/FileUploadExtractor.tsx:259-272`

**Step 1: Update the accommodation preview section**

Replace the single accommodation preview with a loop:
```tsx
{extracted.accommodation && extracted.accommodation.length > 0 && (
  <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
    <h4 className="mb-2 text-sm font-semibold">לינה</h4>
    {extracted.accommodation.map((acc, idx) => (
      <div key={idx} className={idx > 0 ? "mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-700" : ""}>
        {extracted.accommodation!.length > 1 && acc.name && (
          <p className="mb-1 text-xs font-medium text-zinc-500">{acc.name}</p>
        )}
        <div className="flex flex-col gap-1">
          <PreviewField label="שם" value={acc.name} />
          <PreviewField label="כתובת" value={acc.address} />
          <PreviewField label="צ'ק-אין" value={formatDateTimeDisplay(acc.checkIn)} />
          <PreviewField label="צ'ק-אאוט" value={formatDateTimeDisplay(acc.checkOut)} />
          <PreviewField label="פרטי קשר" value={acc.contact} />
          <PreviewField label="מספר הזמנה" value={acc.bookingReference} />
        </div>
      </div>
    ))}
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/components/trips/FileUploadExtractor.tsx
git commit -m "feat: preview multiple accommodations in file upload extractor"
```

---

### Task 10: Update TripMap to show pins for all accommodations

**Files:**
- Modify: `src/components/maps/TripMap.tsx:12-17,77-78`

**Step 1: Update TripMapProps to accept multiple accommodation markers**

```ts
interface TripMapProps {
  center: { lat: number; lng: number }
  accommodations?: MarkerData[]  // NEW — replaces the single "לינה" marker
  attractions?: MarkerData[]
  restaurants?: MarkerData[]
  zoom?: number
}
```

**Step 2: Replace the single accommodation marker (line 78) with a loop**

```ts
// Replace: addMarker(center, "לינה", "#3b82f6")
// With:
if (accommodations && accommodations.length > 0) {
  for (const acc of accommodations) {
    addMarker({ lat: acc.lat, lng: acc.lng }, acc.name, "#3b82f6")
  }
} else {
  addMarker(center, "לינה", "#3b82f6")
}
```

**Step 3: Update the TripMap call in TripDashboard** (already covered in Task 5)

Pass accommodation markers:
```tsx
<TripMap
  center={mapCenter}
  accommodations={accommodations.filter((a) => a.coordinates).map((a) => ({
    lat: a.coordinates!.lat, lng: a.coordinates!.lng, name: a.name || "לינה"
  }))}
  attractions={...}
  restaurants={...}
/>
```

**Step 4: Commit**

```bash
git add src/components/maps/TripMap.tsx src/components/trips/TripDashboard.tsx
git commit -m "feat: show map pins for all accommodations"
```

---

### Task 11: Manual smoke test

**Step 1: Run the dev server**

```bash
npm run dev
```

**Step 2: Test the following flows**

- Create a new trip with two accommodations (airport hotel + main hotel)
- Verify both appear in the overview tab
- Edit the trip and add/remove accommodations
- Check the schedule view for accommodation badges on each day
- Verify the map shows pins for both accommodations
- Export to DOCX and verify both accommodations appear

**Step 3: Commit any fixes if needed**
