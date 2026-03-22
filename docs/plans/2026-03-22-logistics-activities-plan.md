# Logistics Activities Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically add flight and car rental logistics activities to trip itineraries, with configurable durations in the family profile.

**Architecture:** A server-side `syncLogisticsActivities` utility reads trip flight/car data + family profile duration settings, deletes existing logistics activities, and recreates them with correct times. Called from both schedule generation and trip update endpoints.

**Tech Stack:** Next.js 14 (App Router), Prisma ORM, PostgreSQL, React, Tailwind CSS

---

### Task 1: Prisma Schema — Add logistics duration fields to FamilyProfile

**Files:**
- Modify: `prisma/schema.prisma:62-78`

**Step 1: Add the three new fields to FamilyProfile model**

In `prisma/schema.prisma`, add these fields after `pace` (line 72):

```prisma
  preFlightArrivalMinutes  Int @default(180)
  carPickupDurationMinutes Int @default(120)
  carReturnDurationMinutes Int @default(60)
```

**Step 2: Generate and apply migration**

Run: `npx prisma migrate dev --name add-logistics-durations`
Expected: Migration created and applied successfully.

**Step 3: Verify Prisma client regenerated**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add logistics duration fields to FamilyProfile schema"
```

---

### Task 2: Family API — Accept new fields in PUT endpoint

**Files:**
- Modify: `src/app/api/family/route.ts:27-59`

**Step 1: Update the PUT handler to destructure and persist the new fields**

In `src/app/api/family/route.ts`, update the destructuring at line 34:

```typescript
const { attractionTypes, foodPreferences, noLayovers, preferredFlightStart, preferredFlightEnd, pace, preFlightArrivalMinutes, carPickupDurationMinutes, carReturnDurationMinutes } = body
```

Add the three new fields to both `update` and `create` objects in the `upsert` call:

```typescript
const profile = await prisma.familyProfile.upsert({
  where: { userId: session.user.id },
  update: {
    attractionTypes,
    foodPreferences,
    noLayovers,
    preferredFlightStart: preferredFlightStart || null,
    preferredFlightEnd: preferredFlightEnd || null,
    pace,
    ...(preFlightArrivalMinutes !== undefined && { preFlightArrivalMinutes }),
    ...(carPickupDurationMinutes !== undefined && { carPickupDurationMinutes }),
    ...(carReturnDurationMinutes !== undefined && { carReturnDurationMinutes }),
  },
  create: {
    userId: session.user.id,
    attractionTypes,
    foodPreferences,
    noLayovers,
    preferredFlightStart: preferredFlightStart || null,
    preferredFlightEnd: preferredFlightEnd || null,
    pace,
    ...(preFlightArrivalMinutes !== undefined && { preFlightArrivalMinutes }),
    ...(carPickupDurationMinutes !== undefined && { carPickupDurationMinutes }),
    ...(carReturnDurationMinutes !== undefined && { carReturnDurationMinutes }),
  },
  include: { members: true },
})
```

**Step 2: Verify the app compiles**

Run: `npx next build 2>&1 | head -30` (or `npx tsc --noEmit`)
Expected: No type errors related to family route.

**Step 3: Commit**

```bash
git add src/app/api/family/route.ts
git commit -m "feat: accept logistics duration fields in family API"
```

---

### Task 3: FamilyProfileForm — Add logistics duration inputs

**Files:**
- Modify: `src/components/family/FamilyProfileForm.tsx`

**Step 1: Update the interface and add state**

Add to `FamilyProfileFormProps.initialData`:

```typescript
preFlightArrivalMinutes: number
carPickupDurationMinutes: number
carReturnDurationMinutes: number
```

Add state variables after the existing ones (around line 46):

```typescript
const [preFlightArrivalMinutes, setPreFlightArrivalMinutes] = useState(initialData.preFlightArrivalMinutes)
const [carPickupDurationMinutes, setCarPickupDurationMinutes] = useState(initialData.carPickupDurationMinutes)
const [carReturnDurationMinutes, setCarReturnDurationMinutes] = useState(initialData.carReturnDurationMinutes)
```

**Step 2: Add the new fields to the save handler**

In `handleSave`, add to the JSON body:

```typescript
preFlightArrivalMinutes,
carPickupDurationMinutes,
carReturnDurationMinutes,
```

**Step 3: Add the UI section**

After the flight constraints section (after line ~168, before the Pace section), add:

```tsx
{/* Logistics Times */}
<div>
  <label className="mb-2 block text-sm font-semibold">זמני לוגיסטיקה</label>
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-500 w-48">הגעה לשדה תעופה לפני טיסה:</span>
      <input
        type="number"
        min={30}
        max={360}
        step={30}
        value={preFlightArrivalMinutes}
        onChange={(e) => {
          setPreFlightArrivalMinutes(Number(e.target.value))
          setSaved(false)
        }}
        className="w-20 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
      />
      <span className="text-sm text-zinc-500">דקות</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-500 w-48">זמן איסוף רכב שכור:</span>
      <input
        type="number"
        min={15}
        max={240}
        step={15}
        value={carPickupDurationMinutes}
        onChange={(e) => {
          setCarPickupDurationMinutes(Number(e.target.value))
          setSaved(false)
        }}
        className="w-20 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
      />
      <span className="text-sm text-zinc-500">דקות</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-500 w-48">זמן החזרת רכב שכור:</span>
      <input
        type="number"
        min={15}
        max={180}
        step={15}
        value={carReturnDurationMinutes}
        onChange={(e) => {
          setCarReturnDurationMinutes(Number(e.target.value))
          setSaved(false)
        }}
        className="w-20 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-700"
      />
      <span className="text-sm text-zinc-500">דקות</span>
    </div>
  </div>
</div>
```

**Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/components/family/FamilyProfileForm.tsx
git commit -m "feat: add logistics duration settings to family profile form"
```

---

### Task 4: Create `syncLogisticsActivities` utility

**Files:**
- Create: `src/lib/sync-logistics.ts`

**Step 1: Create the sync utility**

Create `src/lib/sync-logistics.ts`:

```typescript
import { prisma } from "@/lib/prisma"

const LOGISTICS_TYPES = [
  "flight_departure",
  "flight_arrival",
  "car_pickup",
  "car_return",
] as const

interface FlightLeg {
  flightNumber?: string
  departureAirport?: string
  departureTime?: string
  arrivalAirport?: string
  arrivalTime?: string
}

interface FlightsData {
  outbound?: FlightLeg
  return?: FlightLeg
}

interface CarRentalData {
  company?: string
  pickupLocation?: string
  returnLocation?: string
}

interface LogisticsActivity {
  date: Date
  type: string
  timeStart: string | null
  timeEnd: string | null
  notes: string
  sortOrder: number
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number)
  const totalMinutes = h * 60 + m + minutes
  const newH = Math.floor(totalMinutes / 60) % 24
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`
}

function subtractMinutes(timeStr: string, minutes: number): string {
  return addMinutes(timeStr, -minutes)
}

function getDateOnly(isoString: string): Date {
  const d = new Date(isoString)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

function getTimeFromISO(isoString: string): string {
  const d = new Date(isoString)
  return formatTime(d)
}

export async function syncLogisticsActivities(tripId: string, userId: string) {
  // Load trip with day plans
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      dayPlans: {
        include: { activities: true },
        orderBy: { date: "asc" },
      },
    },
  })

  if (!trip || trip.dayPlans.length === 0) return

  // Load family profile for duration settings
  const profile = await prisma.familyProfile.findUnique({
    where: { userId },
  })

  const preFlightMinutes = profile?.preFlightArrivalMinutes ?? 180
  const carPickupMinutes = profile?.carPickupDurationMinutes ?? 120
  const carReturnMinutes = profile?.carReturnDurationMinutes ?? 60

  const flights = trip.flights as FlightsData | null
  const carRental = trip.carRental as CarRentalData | null

  // Build list of logistics activities to create
  const activitiesToCreate: LogisticsActivity[] = []

  // --- Flight activities ---
  if (flights?.outbound?.departureTime) {
    const depDate = getDateOnly(flights.outbound.departureTime)
    const depTime = getTimeFromISO(flights.outbound.departureTime)
    const arriveAtAirport = subtractMinutes(depTime, preFlightMinutes)

    activitiesToCreate.push({
      date: depDate,
      type: "flight_departure",
      timeStart: arriveAtAirport,
      timeEnd: depTime,
      notes: [flights.outbound.flightNumber, flights.outbound.departureAirport]
        .filter(Boolean)
        .join(" - "),
      sortOrder: 0,
    })
  }

  if (flights?.outbound?.arrivalTime) {
    const arrDate = getDateOnly(flights.outbound.arrivalTime)
    const arrTime = getTimeFromISO(flights.outbound.arrivalTime)

    activitiesToCreate.push({
      date: arrDate,
      type: "flight_arrival",
      timeStart: arrTime,
      timeEnd: null,
      notes: [flights.outbound.flightNumber, flights.outbound.arrivalAirport]
        .filter(Boolean)
        .join(" - "),
      sortOrder: 1,
    })
  }

  if (flights?.return?.departureTime) {
    const depDate = getDateOnly(flights.return.departureTime)
    const depTime = getTimeFromISO(flights.return.departureTime)
    const arriveAtAirport = subtractMinutes(depTime, preFlightMinutes)

    activitiesToCreate.push({
      date: depDate,
      type: "flight_departure",
      timeStart: arriveAtAirport,
      timeEnd: depTime,
      notes: [flights.return.flightNumber, flights.return.departureAirport]
        .filter(Boolean)
        .join(" - "),
      sortOrder: 900,
    })
  }

  if (flights?.return?.arrivalTime) {
    const arrDate = getDateOnly(flights.return.arrivalTime)
    const arrTime = getTimeFromISO(flights.return.arrivalTime)

    activitiesToCreate.push({
      date: arrDate,
      type: "flight_arrival",
      timeStart: arrTime,
      timeEnd: null,
      notes: [flights.return.flightNumber, flights.return.arrivalAirport]
        .filter(Boolean)
        .join(" - "),
      sortOrder: 901,
    })
  }

  // --- Car rental activities ---
  if (carRental?.company || carRental?.pickupLocation) {
    // Car pickup: same day as outbound arrival, or trip start
    let pickupDate: Date
    let pickupTimeStart: string | null = null

    if (flights?.outbound?.arrivalTime) {
      pickupDate = getDateOnly(flights.outbound.arrivalTime)
      const arrTime = getTimeFromISO(flights.outbound.arrivalTime)
      pickupTimeStart = arrTime
    } else {
      pickupDate = new Date(
        Date.UTC(
          trip.startDate.getFullYear(),
          trip.startDate.getMonth(),
          trip.startDate.getDate()
        )
      )
    }

    activitiesToCreate.push({
      date: pickupDate,
      type: "car_pickup",
      timeStart: pickupTimeStart,
      timeEnd: pickupTimeStart
        ? addMinutes(pickupTimeStart, carPickupMinutes)
        : null,
      notes: [carRental.company, carRental.pickupLocation]
        .filter(Boolean)
        .join(" - "),
      sortOrder: 2,
    })

    // Car return: same day as return flight departure, or trip end
    let returnDate: Date
    let returnTimeStart: string | null = null

    if (flights?.return?.departureTime) {
      returnDate = getDateOnly(flights.return.departureTime)
      const depTime = getTimeFromISO(flights.return.departureTime)
      // Car return ends before airport arrival: depTime - preFlightMinutes - carReturnMinutes
      const returnEnd = subtractMinutes(depTime, preFlightMinutes)
      returnTimeStart = subtractMinutes(returnEnd, carReturnMinutes)
    } else {
      returnDate = new Date(
        Date.UTC(
          trip.endDate.getFullYear(),
          trip.endDate.getMonth(),
          trip.endDate.getDate()
        )
      )
    }

    activitiesToCreate.push({
      date: returnDate,
      type: "car_return",
      timeStart: returnTimeStart,
      timeEnd: returnTimeStart
        ? addMinutes(returnTimeStart, carReturnMinutes)
        : null,
      notes: [carRental.company, carRental.returnLocation]
        .filter(Boolean)
        .join(" - "),
      sortOrder: 899,
    })
  }

  // --- Execute: delete old logistics activities, create new ones ---
  // Get all day plan IDs for this trip
  const dayPlanIds = trip.dayPlans.map((dp) => dp.id)

  // Build a map of date -> dayPlanId
  const dateToDay = new Map<string, string>()
  for (const dp of trip.dayPlans) {
    const key = dp.date.toISOString().split("T")[0]
    dateToDay.set(key, dp.id)
  }

  // Delete all existing logistics activities for this trip
  await prisma.activity.deleteMany({
    where: {
      dayPlanId: { in: dayPlanIds },
      type: { in: [...LOGISTICS_TYPES] },
    },
  })

  // Create new logistics activities
  for (const activity of activitiesToCreate) {
    const dateKey = activity.date.toISOString().split("T")[0]
    const dayPlanId = dateToDay.get(dateKey)

    if (!dayPlanId) continue // Day not in trip range — skip

    await prisma.activity.create({
      data: {
        dayPlanId,
        sortOrder: activity.sortOrder,
        timeStart: activity.timeStart,
        timeEnd: activity.timeEnd,
        type: activity.type,
        notes: activity.notes || null,
      },
    })
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/sync-logistics.ts
git commit -m "feat: add syncLogisticsActivities utility"
```

---

### Task 5: Call sync from schedule generation endpoint

**Files:**
- Modify: `src/app/api/trips/[tripId]/schedule/route.ts:55-139`

**Step 1: Import and call sync after day plan creation**

Add import at top:

```typescript
import { syncLogisticsActivities } from "@/lib/sync-logistics"
```

After the transaction that creates day plans (line 121), before the final fetch (line 124), add:

```typescript
// Sync logistics activities from flight/car data
await syncLogisticsActivities(tripId, session.user.id)
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/trips/[tripId]/schedule/route.ts
git commit -m "feat: sync logistics activities on schedule generation"
```

---

### Task 6: Call sync from trip update endpoint

**Files:**
- Modify: `src/app/api/trips/[tripId]/route.ts:55-97`

**Step 1: Import and call sync after trip update when flights or carRental changed**

Add import at top:

```typescript
import { syncLogisticsActivities } from "@/lib/sync-logistics"
```

After the `prisma.trip.update` call (after line 94), add:

```typescript
// Sync logistics activities if flights or car rental data changed
if (flights !== undefined || carRental !== undefined) {
  await syncLogisticsActivities(tripId, session.user.id)
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/trips/[tripId]/route.ts
git commit -m "feat: sync logistics activities on trip update"
```

---

### Task 7: ActivityCard — Add logistics type icons and labels

**Files:**
- Modify: `src/components/schedule/ActivityCard.tsx:19-25`

**Step 1: Add the 4 logistics types to typeConfig**

Add these entries to the `typeConfig` object:

```typescript
flight_departure: { icon: "✈️", label: "טיסת יציאה" },
flight_arrival: { icon: "🛬", label: "טיסת הגעה" },
car_pickup: { icon: "🚗", label: "איסוף רכב" },
car_return: { icon: "🔑", label: "החזרת רכב" },
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/schedule/ActivityCard.tsx
git commit -m "feat: add logistics activity type icons and labels"
```

---

### Task 8: Verify end-to-end — build and manual test

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: auto-generate logistics activities from flight and car rental data"
```
