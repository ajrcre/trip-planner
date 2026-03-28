# Grocery Stores + Accommodation Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add grocery store search and management following existing restaurant/attraction patterns, and add an accommodation selector to all discovery panels for multi-accommodation trips.

**Architecture:** Follows the existing generic component pattern (DiscoveryPanel, ItemTable, ItemCard) with grocery-store-specific wrappers. The generic DiscoveryPanel gains an optional `accommodations` prop to render a selector when trips have 2+ accommodations, passing the selected accommodation's coordinates to discover endpoints.

**Tech Stack:** Next.js API routes, Prisma, Google Places API, React, Tailwind CSS

---

### Task 1: Prisma Schema — Add GroceryStore Model

**Files:**
- Modify: `prisma/schema.prisma` (add model after Restaurant ~line 220, update Trip ~line 117, update Activity ~line 254)

- [ ] **Step 1: Add GroceryStore model to schema**

Add after the Restaurant model (after line 220):

```prisma
// === Grocery Stores ===

model GroceryStore {
  id     String @id @default(cuid())
  tripId String
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)

  googlePlaceId String?
  name          String
  address       String?
  lat           Float?
  lng           Float?
  phone         String?
  website       String?
  openingHours  Json?
  photos        String[] @default([])

  ratingGoogle      Float?
  storeType         String?
  travelTimeMinutes Int?
  travelDistanceKm  Float?

  status          String   @default("maybe")
  dataLastUpdated DateTime?
  dataSource      String?

  activities Activity[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tripId])
}
```

- [ ] **Step 2: Add Trip relation**

In the Trip model (~line 117), add after `restaurants Restaurant[]`:

```prisma
  groceryStores GroceryStore[]
```

- [ ] **Step 3: Add Activity FK**

In the Activity model (~line 254), add after the restaurant relation fields:

```prisma
  groceryStoreId String?
  groceryStore   GroceryStore? @relation(fields: [groceryStoreId], references: [id])
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add-grocery-store-model
```

Expected: Migration created and applied successfully.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add GroceryStore model with Trip and Activity relations"
```

---

### Task 2: Store Type Mapping Utility

**Files:**
- Create: `src/lib/store-types.ts`

- [ ] **Step 1: Create store type mapping**

```typescript
// Maps Google Place types to Hebrew store type labels

const storeTypeMap: Record<string, string> = {
  supermarket: "סופרמרקט",
  grocery_or_supermarket: "סופרמרקט",
  convenience_store: "מכולת",
  health_food_store: "טבע",
  organic_store: "אורגני",
  market: "שוק",
  farmers_market: "שוק איכרים",
  food_store: "חנות מזון",
  grocery_store: "מכולת",
}

export function mapStoreType(types: string[]): string | null {
  for (const type of types) {
    if (storeTypeMap[type]) return storeTypeMap[type]
  }
  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/store-types.ts
git commit -m "feat: add store type mapping utility for grocery stores"
```

---

### Task 3: Grocery Store API Routes

**Files:**
- Create: `src/app/api/trips/[tripId]/grocery-stores/route.ts`
- Create: `src/app/api/trips/[tripId]/grocery-stores/[id]/route.ts`
- Create: `src/app/api/trips/[tripId]/grocery-stores/discover/route.ts`

- [ ] **Step 1: Create GET/POST route**

Create `src/app/api/trips/[tripId]/grocery-stores/route.ts`:

```typescript
import { NextResponse } from "next/server"

import { searchPlaces, calculateRoute } from "@/lib/google-maps"
import { normalizeAccommodations } from "@/lib/accommodations"
import { requireTripAccess } from "@/lib/trip-access"
import { mapStoreType } from "@/lib/store-types"
import prisma from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const groceryStores = await prisma.groceryStore.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(groceryStores)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip } = result

  const body = await request.json()
  const {
    googlePlaceId, name, address, lat, lng, phone, website,
    openingHours, photos, ratingGoogle, storeType, types, status,
  } = body

  // Calculate travel time from accommodation
  let travelTimeMinutes: number | null = null
  let travelDistanceKm: number | null = null

  if (lat != null && lng != null) {
    const accommodations = normalizeAccommodations(trip.accommodation)
    const withCoords = accommodations.find((a) => a.coordinates)
    if (withCoords?.coordinates) {
      try {
        const route = await calculateRoute(
          { lat: withCoords.coordinates.lat, lng: withCoords.coordinates.lng },
          { lat, lng }
        )
        travelTimeMinutes = route.durationMinutes
        travelDistanceKm = route.distanceKm
      } catch {
        // Travel time unavailable
      }
    }
  }

  const resolvedStoreType = storeType || (types ? mapStoreType(types) : null)

  const groceryStore = await prisma.groceryStore.create({
    data: {
      tripId,
      googlePlaceId,
      name,
      address,
      lat,
      lng,
      phone,
      website,
      openingHours: openingHours ?? undefined,
      photos: photos ?? [],
      ratingGoogle,
      storeType: resolvedStoreType,
      travelTimeMinutes,
      travelDistanceKm,
      status: status || "maybe",
      dataSource: "google_places",
      dataLastUpdated: new Date(),
    },
  })

  return NextResponse.json(groceryStore, { status: 201 })
}
```

- [ ] **Step 2: Create PUT/DELETE route**

Create `src/app/api/trips/[tripId]/grocery-stores/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server"

import { requireTripAccess } from "@/lib/trip-access"
import prisma from "@/lib/prisma"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tripId: string; id: string }> }
) {
  const { tripId, id } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const existing = await prisma.groceryStore.findFirst({
    where: { id, tripId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json()
  const { status, storeType } = body

  const updateData: Record<string, unknown> = {}
  if (status !== undefined) updateData.status = status
  if (storeType !== undefined) updateData.storeType = storeType

  const updated = await prisma.groceryStore.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string; id: string }> }
) {
  const { tripId, id } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const existing = await prisma.groceryStore.findFirst({
    where: { id, tripId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.groceryStore.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create discover route**

Create `src/app/api/trips/[tripId]/grocery-stores/discover/route.ts`:

```typescript
import { NextResponse } from "next/server"

import { searchPlaces, calculateRoute } from "@/lib/google-maps"
import { normalizeAccommodations } from "@/lib/accommodations"
import { requireTripAccess } from "@/lib/trip-access"
import { mapStoreType } from "@/lib/store-types"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip } = result

  const body = await request.json()
  const { query, types, radius, accommodationId } = body as {
    query?: string
    types?: string[]
    radius?: number
    accommodationId?: string
  }

  // Get accommodation coordinates for location bias
  const accommodations = normalizeAccommodations(trip.accommodation)

  // Use selected accommodation or fall back to first with coordinates
  let selectedAccommodation = accommodations.find((a) => a.coordinates)
  if (accommodationId) {
    const byId = accommodations.find(
      (a, i) => `${i}` === accommodationId || a.name === accommodationId
    )
    if (byId?.coordinates) selectedAccommodation = byId
  }

  const location = selectedAccommodation?.coordinates
  if (!location) {
    return NextResponse.json(
      { error: "הוסף כתובת לינה עם קואורדינטות לפני חיפוש חנויות" },
      { status: 400 }
    )
  }
  const searchRadius = radius ?? 50000

  const searchQuery = query || `grocery store ${trip.destination}`
  const typeString = types?.length ? types.join(" ") : undefined

  try {
    const results = await searchPlaces(
      searchQuery,
      location,
      searchRadius,
      typeString
    )

    const places = results.slice(0, 20).map((place) => ({
      googlePlaceId: place.id,
      name: place.displayName?.text ?? "",
      description: place.editorialSummary?.text ?? null,
      address: place.formattedAddress ?? null,
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      rating: place.rating ?? null,
      userRatingCount: place.userRatingCount ?? null,
      photos: place.photos?.map((p) => p.name) ?? [],
      types: place.types ?? [],
      storeType: mapStoreType(place.types ?? []),
      websiteUri: place.websiteUri ?? null,
      openingHours: place.regularOpeningHours?.weekdayDescriptions ?? null,
      travelTimeMinutes: null as number | null,
      distanceKm: null as number | null,
    }))

    // Calculate travel times from accommodation in parallel
    const routePromises = places.map(async (place) => {
      if (place.lat == null || place.lng == null) return place
      try {
        const route = await calculateRoute(
          { lat: location.lat, lng: location.lng },
          { lat: place.lat, lng: place.lng }
        )
        place.travelTimeMinutes = route.durationMinutes
        place.distanceKm = route.distanceKm
      } catch {
        // Travel time unavailable
      }
      return place
    })

    const enriched = await Promise.all(routePromises)

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Grocery store discovery search failed:", error)
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/trips/\[tripId\]/grocery-stores/
git commit -m "feat: add grocery store API routes (CRUD + discover)"
```

---

### Task 4: Accommodation Selector in Generic DiscoveryPanel

**Files:**
- Modify: `src/components/discovery/DiscoveryPanel.tsx` (lines 27-31 props, line 70 handleSearch body)

- [ ] **Step 1: Add accommodations prop and state**

In `src/components/discovery/DiscoveryPanel.tsx`, update the `DiscoveryPanelProps` interface (line 27-31) to add the optional accommodations prop:

```typescript
interface Accommodation {
  name?: string
  address?: string
  coordinates?: { lat: number; lng: number }
}

interface DiscoveryPanelProps<T extends DiscoveryItem> {
  tripId: string
  savedPlaceIds: Set<string>
  config: DiscoveryConfig<T>
  accommodations?: Accommodation[]
}
```

Update the component destructuring (line 33-37) to accept accommodations:

```typescript
export function DiscoveryPanel<T extends DiscoveryItem>({
  tripId,
  savedPlaceIds,
  config,
  accommodations,
}: DiscoveryPanelProps<T>) {
```

Add state for selected accommodation after line 55:

```typescript
const [selectedAccommodationIdx, setSelectedAccommodationIdx] = useState(0)
```

- [ ] **Step 2: Pass accommodationId in handleSearch**

Update the fetch body in `handleSearch` (line 70) to include accommodationId when accommodations are provided:

```typescript
body: JSON.stringify({
  query: q || undefined,
  ...(accommodations && accommodations.length > 1
    ? { accommodationId: `${selectedAccommodationIdx}` }
    : {}),
}),
```

- [ ] **Step 3: Add accommodation selector UI**

Add the accommodation dropdown after the search bar section (after line 147), before the quick filter chips. Only render when 2+ accommodations exist:

```tsx
{/* Accommodation selector */}
{accommodations && accommodations.length > 1 && (
  <div className="flex items-center gap-2">
    <span className="text-xs text-zinc-500">{"חפש ליד:"}</span>
    <select
      value={selectedAccommodationIdx}
      onChange={(e) => setSelectedAccommodationIdx(Number(e.target.value))}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
      dir="rtl"
    >
      {accommodations.map((acc, i) => (
        <option key={i} value={i}>
          {acc.name || acc.address || `לינה ${i + 1}`}
        </option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/discovery/DiscoveryPanel.tsx
git commit -m "feat: add accommodation selector to generic DiscoveryPanel"
```

---

### Task 5: Update Restaurant & Attraction Discover Routes for accommodationId

**Files:**
- Modify: `src/app/api/trips/[tripId]/restaurants/discover/route.ts` (lines 18-28)
- Modify: `src/app/api/trips/[tripId]/attractions/discover/route.ts` (same pattern)

- [ ] **Step 1: Update restaurant discover route**

In `src/app/api/trips/[tripId]/restaurants/discover/route.ts`, update the body parsing (lines 18-23) to include `accommodationId`:

```typescript
const { query, types, radius, accommodationId } = body as {
  query?: string
  types?: string[]
  radius?: number
  accommodationId?: string
}
```

Update the accommodation selection (lines 26-28) to use `accommodationId` when provided:

```typescript
const accommodations = normalizeAccommodations(trip.accommodation)

let accommodationWithCoords = accommodations.find((a) => a.coordinates)
if (accommodationId) {
  const byId = accommodations.find(
    (a, i) => `${i}` === accommodationId || a.name === accommodationId
  )
  if (byId?.coordinates) accommodationWithCoords = byId
}

const location = accommodationWithCoords?.coordinates
```

- [ ] **Step 2: Update attraction discover route**

Apply the same `accommodationId` parsing and accommodation selection changes to `src/app/api/trips/[tripId]/attractions/discover/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trips/\[tripId\]/restaurants/discover/route.ts src/app/api/trips/\[tripId\]/attractions/discover/route.ts
git commit -m "feat: support accommodationId in restaurant and attraction discover routes"
```

---

### Task 6: Pass Accommodations to Restaurant & Attraction Discovery Panels

**Files:**
- Modify: `src/components/restaurants/DiscoveryPanel.tsx` (lines 24-28 props, line 88-92 rendering)
- Modify: `src/components/attractions/DiscoveryPanel.tsx` (same pattern)
- Modify: `src/components/trips/tabs/RestaurantsTab.tsx` (line 83-87 rendering)
- Modify: `src/components/trips/tabs/AttractionsTab.tsx` (same pattern)

- [ ] **Step 1: Update restaurant DiscoveryPanel wrapper**

In `src/components/restaurants/DiscoveryPanel.tsx`, add `accommodations` to the props interface (line 24-28):

```typescript
interface DiscoveryPanelProps {
  tripId: string
  savedPlaceIds: Set<string>
  onRestaurantSaved: () => void
  accommodations?: Array<{ name?: string; address?: string; coordinates?: { lat: number; lng: number } }>
}
```

Pass accommodations through to the generic panel (line 88-92):

```tsx
<GenericDiscoveryPanel
  tripId={tripId}
  savedPlaceIds={savedPlaceIds}
  config={config}
  accommodations={accommodations}
/>
```

- [ ] **Step 2: Update RestaurantsTab to pass accommodations**

In `src/components/trips/tabs/RestaurantsTab.tsx`, extract accommodations from trip and pass them to the discovery panel (line 83-87):

```tsx
<RestaurantDiscoveryPanel
  tripId={trip.id}
  savedPlaceIds={savedPlaceIds}
  onRestaurantSaved={fetchRestaurants}
  accommodations={trip.accommodation ?? undefined}
/>
```

- [ ] **Step 3: Apply same changes to attraction DiscoveryPanel and AttractionsTab**

Same pattern as steps 1-2 for the attraction equivalents.

- [ ] **Step 4: Commit**

```bash
git add src/components/restaurants/DiscoveryPanel.tsx src/components/attractions/DiscoveryPanel.tsx src/components/trips/tabs/RestaurantsTab.tsx src/components/trips/tabs/AttractionsTab.tsx
git commit -m "feat: pass accommodations to restaurant and attraction discovery panels"
```

---

### Task 7: Grocery Store UI Components

**Files:**
- Create: `src/components/grocery-stores/GroceryStoreCard.tsx`
- Create: `src/components/grocery-stores/GroceryStoreTable.tsx`
- Create: `src/components/grocery-stores/DiscoveryPanel.tsx`

- [ ] **Step 1: Create GroceryStoreCard**

Create `src/components/grocery-stores/GroceryStoreCard.tsx`. Follow the pattern in `src/components/restaurants/RestaurantCard.tsx` but with green styling and `storeType` instead of `cuisineType`:

```tsx
"use client"

import { ItemCard, type DiscoveredItem } from "@/components/shared/ItemCard"

export interface DiscoveredGroceryStore extends DiscoveredItem {
  storeType: string | null
}

function NameWithStoreType({ name, storeType }: { name: string; storeType: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold">{name}</span>
      {storeType && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
          {storeType}
        </span>
      )}
    </div>
  )
}

export function GroceryStoreCard({
  store,
  savedIds,
  onSave,
}: {
  store: DiscoveredGroceryStore
  savedIds: Set<string>
  onSave: (item: DiscoveredGroceryStore, status: string) => void
}) {
  return (
    <ItemCard
      item={store}
      savedIds={savedIds}
      onSave={onSave}
      gradientClasses="from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
      headerTextClasses="text-green-900 dark:text-green-100"
      typeContent={<NameWithStoreType name={store.name} storeType={store.storeType} />}
    />
  )
}
```

- [ ] **Step 2: Create GroceryStoreTable**

Create `src/components/grocery-stores/GroceryStoreTable.tsx`. Follow the pattern in `src/components/restaurants/RestaurantTable.tsx` with green styling, `storeType` column, and simpler expanded row (no kidFriendly):

```tsx
"use client"

import { useState, useMemo } from "react"
import { useItemActions } from "@/hooks/useItemActions"
import { useTableFiltering, commonComparators } from "@/hooks/useTableFiltering"
import {
  ItemTable,
  type BaseItem,
  nameColumn,
  travelTimeColumn,
  ratingColumn,
  openingHoursColumn,
  statusColumn,
  linksColumn,
  deleteColumn,
} from "@/components/shared/ItemTable"
import { OpeningHoursSection } from "@/components/schedule/OpeningHoursSection"
import { statusLabels, statusColors } from "@/lib/status-config"

interface SavedGroceryStore extends BaseItem {
  storeType: string | null
  travelDistanceKm: number | null
}

type SortField = "name" | "travelTime" | "rating"

export function GroceryStoreTable({
  tripId,
  groceryStores,
  onUpdate,
}: {
  tripId: string
  groceryStores: SavedGroceryStore[]
  onUpdate: () => void
}) {
  const { updatingId, handleStatusChange, handleDelete } = useItemActions({
    tripId,
    entityPath: "grocery-stores",
    onUpdate,
  })

  const sortComparators: Record<SortField, (a: SavedGroceryStore, b: SavedGroceryStore) => number> = {
    name: commonComparators.byName,
    travelTime: commonComparators.byTravelTime,
    rating: commonComparators.byRating,
  }

  const { filter, setFilter, sortField, setSortField, sorted } = useTableFiltering<SavedGroceryStore, SortField>({
    items: groceryStores,
    defaultSort: "name",
    sortComparators,
  })

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const columns = useMemo(() => [
    nameColumn<SavedGroceryStore>(),
    {
      key: "storeType",
      label: "סוג",
      render: (item: SavedGroceryStore) =>
        item.storeType ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {item.storeType}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    travelTimeColumn<SavedGroceryStore>(),
    ratingColumn<SavedGroceryStore>(),
    openingHoursColumn<SavedGroceryStore>(),
    statusColumn<SavedGroceryStore>(handleStatusChange, updatingId),
    linksColumn<SavedGroceryStore>(),
    deleteColumn<SavedGroceryStore>(handleDelete, updatingId),
  ], [handleStatusChange, handleDelete, updatingId])

  const sortOptions: { value: SortField; label: string }[] = [
    { value: "name", label: "שם" },
    { value: "travelTime", label: "זמן נסיעה" },
    { value: "rating", label: "דירוג" },
  ]

  return (
    <ItemTable
      items={groceryStores}
      sorted={sorted}
      columns={columns}
      sortOptions={sortOptions}
      sortField={sortField}
      setSortField={setSortField}
      filter={filter}
      setFilter={setFilter}
      updatingId={updatingId}
      expandedId={expandedId}
      setExpandedId={setExpandedId}
      handleStatusChange={handleStatusChange}
      handleDelete={handleDelete}
      emptyMessage="לא נוספו חנויות עדיין"
      rowClickToExpand
      renderExpanded={(store) => (
        <div className="space-y-3 p-4 text-sm" dir="rtl">
          {store.address && (
            <div><span className="font-medium">כתובת:</span> {store.address}</div>
          )}
          {store.phone && (
            <div><span className="font-medium">טלפון:</span> <a href={`tel:${store.phone}`} className="text-blue-600 hover:underline">{store.phone}</a></div>
          )}
          {store.website && (
            <div><span className="font-medium">אתר:</span> <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{store.website}</a></div>
          )}
          <OpeningHoursSection openingHours={store.openingHours} />
          <div className="flex gap-2 pt-2">
            {(["want", "maybe", "rejected"] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(store.id, s)}
                disabled={updatingId === store.id}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  store.status === s
                    ? statusColors[s]
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400"
                }`}
              >
                {statusLabels[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    />
  )
}
```

**Note:** Add `import { useState } from "react"` at the top along with the other imports.

- [ ] **Step 3: Create GroceryStore DiscoveryPanel**

Create `src/components/grocery-stores/DiscoveryPanel.tsx`. Follow the pattern in `src/components/restaurants/DiscoveryPanel.tsx`:

```tsx
"use client"

import { DiscoveryPanel as GenericDiscoveryPanel, type DiscoveryConfig } from "@/components/discovery/DiscoveryPanel"
import { GroceryStoreCard, type DiscoveredGroceryStore } from "./GroceryStoreCard"

interface DiscoveryPanelProps {
  tripId: string
  savedPlaceIds: Set<string>
  onStoreSaved: () => void
  accommodations?: Array<{ name?: string; address?: string; coordinates?: { lat: number; lng: number } }>
}

const quickFilters = [
  { label: "סופרמרקט", query: "supermarket" },
  { label: "מכולת", query: "convenience store" },
  { label: "אורגני", query: "organic grocery store" },
  { label: "כשר", query: "kosher grocery store" },
  { label: "שוק מקומי", query: "local market" },
]

function GroceryStoreCardAdapter({
  item,
  savedIds,
  onSave,
}: {
  item: DiscoveredGroceryStore
  savedIds: Set<string>
  onSave: (item: DiscoveredGroceryStore, status: string) => void
}) {
  return (
    <GroceryStoreCard
      store={item}
      savedIds={savedIds}
      onSave={onSave}
    />
  )
}

export function DiscoveryPanel({
  tripId,
  savedPlaceIds,
  onStoreSaved,
  accommodations,
}: DiscoveryPanelProps) {
  const config: DiscoveryConfig<DiscoveredGroceryStore> = {
    discoverEndpoint: "grocery-stores/discover",
    saveEndpoint: "grocery-stores",
    quickFilters,
    CardComponent: GroceryStoreCardAdapter,
    buildSavePayload: (item, status) => ({
      googlePlaceId: item.googlePlaceId,
      name: item.name,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      ratingGoogle: item.rating,
      photos: item.photos,
      storeType: item.storeType,
      website: item.websiteUri,
      openingHours: item.openingHours ? { weekdayDescriptions: item.openingHours } : undefined,
      types: item.types,
      status,
    }),
    onItemSaved: onStoreSaved,
    searchPlaceholder: "חפש חנויות מכולת",
    emptyStateText: "חפש חנויות מכולת או בחר קטגוריה למעלה",
  }

  return (
    <GenericDiscoveryPanel
      tripId={tripId}
      savedPlaceIds={savedPlaceIds}
      config={config}
      accommodations={accommodations}
    />
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/grocery-stores/
git commit -m "feat: add grocery store UI components (card, table, discovery panel)"
```

---

### Task 8: Grocery Stores Tab + Dashboard Integration

**Files:**
- Create: `src/components/trips/tabs/GroceryStoresTab.tsx`
- Modify: `src/components/trips/TripDashboard.tsx` (lines 12-35 Trip interface, lines 37-44 tabs array, lines 99-111 tab rendering)

- [ ] **Step 1: Create GroceryStoresTab**

Create `src/components/trips/tabs/GroceryStoresTab.tsx`. Follow the pattern in `src/components/trips/tabs/RestaurantsTab.tsx`:

```tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import { DiscoveryPanel as GroceryStoreDiscoveryPanel } from "@/components/grocery-stores/DiscoveryPanel"
import { GroceryStoreTable } from "@/components/grocery-stores/GroceryStoreTable"
import type { Trip } from "../TripDashboard"

interface SavedGroceryStore {
  id: string
  googlePlaceId: string | null
  name: string
  storeType: string | null
  address: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  website: string | null
  openingHours: unknown
  ratingGoogle: number | null
  travelTimeMinutes: number | null
  travelDistanceKm: number | null
  status: string
}

export function GroceryStoresTab({ trip }: { trip: Trip }) {
  const [subView, setSubView] = useState<"discover" | "my">(
    trip.groceryStores.length > 0 ? "my" : "discover"
  )
  const [savedStores, setSavedStores] = useState<SavedGroceryStore[]>(
    trip.groceryStores as unknown as SavedGroceryStore[]
  )

  const fetchStores = useCallback(async () => {
    try {
      const response = await fetch(`/api/trips/${trip.id}/grocery-stores`)
      if (response.ok) {
        const data = await response.json()
        setSavedStores(data)
      }
    } catch (error) {
      console.error("Failed to fetch grocery stores:", error)
    }
  }, [trip.id])

  useEffect(() => {
    fetchStores()
  }, [fetchStores])

  const savedPlaceIds = new Set(
    savedStores
      .filter((s) => s.googlePlaceId)
      .map((s) => s.googlePlaceId as string)
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-view toggle */}
      <div className="flex gap-1 self-start rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        <button
          onClick={() => setSubView("my")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            subView === "my"
              ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          החנויות שלי
        </button>
        <button
          onClick={() => setSubView("discover")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            subView === "discover"
              ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          גלה חנויות
        </button>
      </div>

      {/* Content */}
      {subView === "discover" ? (
        <GroceryStoreDiscoveryPanel
          tripId={trip.id}
          savedPlaceIds={savedPlaceIds}
          onStoreSaved={fetchStores}
          accommodations={trip.accommodation ?? undefined}
        />
      ) : (
        <GroceryStoreTable
          tripId={trip.id}
          groceryStores={savedStores}
          onUpdate={fetchStores}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update Trip interface in TripDashboard**

In `src/components/trips/TripDashboard.tsx`, add `groceryStores` to the Trip interface (after line 31 `restaurants: unknown[]`):

```typescript
  groceryStores: unknown[]
```

- [ ] **Step 3: Add grocery stores tab to tabs array**

In `src/components/trips/TripDashboard.tsx`, add the grocery stores tab after the restaurants entry (after line 41 `{ key: "restaurants", label: "מסעדות" },`):

```typescript
  { key: "groceryStores", label: "מכולת" },
```

- [ ] **Step 4: Import and render GroceryStoresTab**

Add the import at the top of `src/components/trips/TripDashboard.tsx`:

```typescript
import { GroceryStoresTab } from "./tabs/GroceryStoresTab"
```

Add the tab rendering after line 109 (`{activeTab === "restaurants" && <RestaurantsTab trip={trip} />}`):

```tsx
      {activeTab === "groceryStores" && <GroceryStoresTab trip={trip} />}
```

- [ ] **Step 5: Update Trip API to include groceryStores**

In `src/app/api/trips/[tripId]/route.ts` GET handler, add `groceryStores: true` to the Prisma `include` block alongside `restaurants: true`.

**Note:** `src/app/api/trips/route.ts` GET returns a minimal trip list (no relations) and does not need changes.

- [ ] **Step 6: Commit**

```bash
git add src/components/trips/tabs/GroceryStoresTab.tsx src/components/trips/TripDashboard.tsx src/app/api/trips/\[tripId\]/route.ts
git commit -m "feat: add grocery stores tab to trip dashboard"
```

---

### Task 9: Verify and Fix Build

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Fix any type errors that arise.

- [ ] **Step 2: Run dev server and verify**

```bash
npm run dev
```

Open the app, navigate to a trip, verify:
- Grocery stores tab appears after Restaurants
- Discovery panel loads with quick filters
- Accommodation selector appears when trip has 2+ accommodations (also on restaurant and attraction tabs)
- Search returns results with green-themed cards
- Saving a store works (want/maybe/rejected)
- Saved stores appear in the table view

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address build issues for grocery stores feature"
```
