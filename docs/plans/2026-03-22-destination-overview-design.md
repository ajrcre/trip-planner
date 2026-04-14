# Destination Overview ("יעד") Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "יעד" tab to the trip dashboard that shows AI-generated destination information (country facts, kids content, tourist dictionary, map, flag) in Hebrew, cached in the database with a refresh button.

**Architecture:** Gemini AI generates all content in a single structured JSON call with grounding enabled for current data (exchange rates, etc.). Content is cached as a `destinationInfo` JSON field on the Trip model. A country-level Google Map with destination pin is rendered client-side. Flag images come from flagcdn.com.

**Tech Stack:** Gemini AI (`@google/generative-ai` with `googleSearchRetrieval`), Google Maps (`@googlemaps/js-api-loader`), flagcdn.com CDN, Prisma, Next.js API routes, Tailwind CSS.

---

### Task 1: Add `destinationInfo` field to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma:107` (after `carRental Json?`)

**Step 1: Add field**

In `prisma/schema.prisma`, add after line 109 (`carRental Json?`):

```prisma
  destinationInfo Json?
```

**Step 2: Run migration**

Run: `npx prisma migrate dev --name add-destination-info`
Expected: Migration created and applied successfully.

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add destinationInfo field to Trip model"
```

---

### Task 2: Add `generateDestinationInfo` to Gemini lib

**Files:**
- Modify: `src/lib/gemini.ts` (append new function at end of file)

**Step 1: Add the DestinationInfo type and generation function**

Append to `src/lib/gemini.ts`:

```typescript
export interface DestinationInfo {
  countryCode: string
  countryNameHebrew: string
  destinationNameHebrew: string
  atAGlance: {
    capital: string
    population: string
    languages: string
    currency: string
    exchangeRate: string
    timezone: string
    electricPlug: string
    emergencyNumber: string
    tippingCustoms: string
  }
  goodToKnow: Array<{ title: string; content: string }>
  kidsCorner: {
    funFacts: string[]
    story: { title: string; content: string }
  }
  dictionary: Array<{
    category: string
    phrases: Array<{
      hebrew: string
      local: string
      transliteration: string
    }>
  }>
  generatedAt: string
}

const DESTINATION_PROMPT = `אתה מומחה נסיעות שמכין מדריך יעד למשפחה ישראלית עם ילדים.
עבור היעד שאתן לך, צור מדריך מלא בעברית בפורמט JSON בלבד.

הפורמט הנדרש:
{
  "countryCode": "ISO 3166-1 alpha-2 code (lowercase, e.g., 'de' for Germany)",
  "countryNameHebrew": "שם המדינה בעברית",
  "destinationNameHebrew": "שם היעד בעברית",
  "atAGlance": {
    "capital": "עיר הבירה",
    "population": "מספר תושבים (מעוגל)",
    "languages": "שפות רשמיות",
    "currency": "מטבע מקומי",
    "exchangeRate": "שער חליפין נוכחי מול שקל (לדוגמה: 1 EUR = 3.95 ILS)",
    "timezone": "אזור זמן ביחס לישראל",
    "electricPlug": "סוג תקע חשמלי (האם צריך מתאם מישראל?)",
    "emergencyNumber": "מספר חירום",
    "tippingCustoms": "נוהגי טיפ מקומיים"
  },
  "goodToKnow": [
    { "title": "כותרת", "content": "תוכן מפורט של 2-3 משפטים" }
  ],
  "kidsCorner": {
    "funFacts": ["עובדה מעניינת 1", "עובדה מעניינת 2", ...],
    "story": { "title": "כותרת הסיפור", "content": "סיפור או אגדה מקומית מעניינת לילדים, 3-5 משפטים" }
  },
  "dictionary": [
    {
      "category": "שם הקטגוריה (ברכות/מסעדה/התמצאות/חירום/קניות/מספרים)",
      "phrases": [
        { "hebrew": "שלום", "local": "Hello", "transliteration": "הלו" }
      ]
    }
  ],
  "generatedAt": "ISO timestamp"
}

כללים:
- החזר רק JSON תקין, בלי markdown, בלי backticks.
- כל התוכן בעברית (חוץ מהשפה המקומית במילון וקוד המדינה).
- שער החליפין צריך להיות עדכני ככל האפשר.
- ב-goodToKnow כלול 4-5 נושאים: תחבורה, בטיחות, נימוסים מקומיים, תרבות אוכל, זמן מומלץ לביקור.
- ב-kidsCorner כלול 4-5 עובדות מפתיעות וסיפור/אגדה אחת.
- במילון כלול 6 קטגוריות עם 5-8 ביטויים בכל קטגוריה.
- countryCode חייב להיות lowercase ISO 3166-1 alpha-2 (לדוגמה: de, fr, it, us, jp).`

export async function generateDestinationInfo(
  destination: string
): Promise<DestinationInfo> {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-pro-preview",
    tools: [{ googleSearchRetrieval: {} }],
  })

  const prompt = `${DESTINATION_PROMPT}\n\nהיעד: ${destination}`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  const cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")

  try {
    const parsed = JSON.parse(cleaned) as DestinationInfo
    parsed.generatedAt = new Date().toISOString()
    return parsed
  } catch {
    throw new Error(`Failed to parse destination info: ${cleaned.slice(0, 200)}`)
  }
}
```

Note: The `tools: [{ googleSearchRetrieval: {} }]` enables Gemini grounding with Google Search for up-to-date data. If the model doesn't support it, remove the `tools` option and the prompt will still ask for current info.

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: add generateDestinationInfo with grounding"
```

---

### Task 3: Create destination API route

**Files:**
- Create: `src/app/api/trips/[tripId]/destination/route.ts`

**Step 1: Create the API route**

Follow the exact auth pattern from `src/app/api/trips/[tripId]/schedule/route.ts` (lines 1-20 for verifyTripAccess).

```typescript
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateDestinationInfo } from "@/lib/gemini"

async function verifyTripAccess(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { shares: true },
  })
  if (!trip) return null
  const isOwner = trip.userId === userId
  const isShared = trip.shares.some((s) => s.userId === userId)
  if (!isOwner && !isShared) return null
  return trip
}

export async function POST(
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

  if (!trip.destination) {
    return NextResponse.json({ error: "Trip has no destination" }, { status: 422 })
  }

  try {
    const info = await generateDestinationInfo(trip.destination)

    await prisma.trip.update({
      where: { id: tripId },
      data: { destinationInfo: info as any },
    })

    return NextResponse.json(info)
  } catch (error) {
    console.error("Failed to generate destination info:", error)
    return NextResponse.json(
      { error: "Failed to generate destination info" },
      { status: 502 }
    )
  }
}
```

**Step 2: Create directory and file**

Run: `mkdir -p src/app/api/trips/\[tripId\]/destination`

**Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add src/app/api/trips/\[tripId\]/destination/
git commit -m "feat: add destination info generation API route"
```

---

### Task 4: Create DestinationMap component

**Files:**
- Create: `src/components/trips/DestinationMap.tsx`

**Step 1: Create the map component**

Reuse existing `loadMapsLibrary` and `loadMarkerLibrary` from `src/lib/google-maps-loader.ts`. Follow the same pattern as `src/components/maps/TripMap.tsx` but with country-level zoom and a single pin.

```typescript
"use client"

import { useEffect, useRef, useState } from "react"
import { loadMapsLibrary, loadMarkerLibrary } from "@/lib/google-maps-loader"

interface DestinationMapProps {
  center: { lat: number; lng: number }
  destinationName: string
}

export function DestinationMap({ center, destinationName }: DestinationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let marker: google.maps.marker.AdvancedMarkerElement | null = null

    async function initMap() {
      if (!mapRef.current) return

      try {
        const { Map } = await loadMapsLibrary()
        const { AdvancedMarkerElement, PinElement } = await loadMarkerLibrary()

        const map = new Map(mapRef.current, {
          center,
          zoom: 6,
          mapId: "destination-overview-map",
        })

        const pin = new PinElement({
          background: "#ef4444",
          borderColor: "#dc2626",
          glyphColor: "#ffffff",
          scale: 1.2,
        })

        marker = new AdvancedMarkerElement({
          map,
          position: center,
          title: destinationName,
          content: pin.element,
        })

        setLoading(false)
      } catch (err) {
        console.error("Failed to load map:", err)
        setError("שגיאה בטעינת המפה")
        setLoading(false)
      }
    }

    initMap()

    return () => {
      if (marker) marker.map = null
    }
  }, [center, destinationName])

  if (error) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
          <span className="text-sm text-zinc-400">טוען מפה...</span>
        </div>
      )}
      <div ref={mapRef} className="h-72 w-full" />
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/components/trips/DestinationMap.tsx
git commit -m "feat: add DestinationMap component for country-level view"
```

---

### Task 5: Create DestinationOverview component

**Files:**
- Create: `src/components/trips/DestinationOverview.tsx`

**Step 1: Create the main component**

This is the largest component. It renders all 6 sections from the cached `destinationInfo` JSON, handles the auto-generate on first visit, and provides a refresh button.

Key references:
- Trip interface: `src/components/trips/TripDashboard.tsx:14-56`
- Tailwind styling: match the card patterns used in OverviewTab (rounded-xl, border-zinc-200, etc.)
- Flag URL pattern: `https://flagcdn.com/w160/{countryCode}.png`
- Map: uses `DestinationMap` component from Task 4
- Coordinates: call `geocodeAddress` via the existing weather API pattern, OR pass coordinates from `trip.accommodation.coordinates` if available. Simpler: geocode in the API route and include coords in the response. Actually, better: geocode client-side is not possible (server-only function). Instead, add coordinates to the API response.

**Important:** Update Task 3's API route to also geocode the destination and include coordinates in the stored data. Add a `coordinates` field to DestinationInfo:

```typescript
// Add to DestinationInfo interface in gemini.ts
coordinates?: { lat: number; lng: number }
```

And in the API route, after generating info:

```typescript
import { geocodeAddress } from "@/lib/google-maps"

// After generating info, before saving:
const coords = await geocodeAddress(trip.destination)
if (coords) {
  info.coordinates = coords
}
```

**Step 2: Write the component**

```typescript
"use client"

import { useState, useEffect } from "react"
import type { DestinationInfo } from "@/lib/gemini"
import { DestinationMap } from "./DestinationMap"

interface DestinationOverviewProps {
  tripId: string
  destination: string
  destinationInfo: DestinationInfo | null
  onGenerated: () => void  // callback to refresh trip data after generation
}

export function DestinationOverview({
  tripId,
  destination,
  destinationInfo,
  onGenerated,
}: DestinationOverviewProps) {
  const [info, setInfo] = useState<DestinationInfo | null>(destinationInfo)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-generate on first visit if no cached data
  useEffect(() => {
    if (!info && !isGenerating) {
      handleGenerate()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}/destination`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Generation failed")
      const data = await res.json()
      setInfo(data)
      onGenerated()
    } catch {
      setError("שגיאה ביצירת מידע על היעד. נסו שוב.")
    } finally {
      setIsGenerating(false)
    }
  }

  // Loading / generating state
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-zinc-200 bg-white p-16 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm text-zinc-500">מכין מידע על {destination}...</p>
        <p className="text-xs text-zinc-400">זה עשוי לקחת מספר שניות</p>
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-200 bg-red-50 p-12 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={handleGenerate}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          נסה שוב
        </button>
      </div>
    )
  }

  if (!info) return null

  return (
    <div className="flex flex-col gap-6">
      {/* Header with flag and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src={`https://flagcdn.com/w160/${info.countryCode}.png`}
            alt={info.countryNameHebrew}
            className="h-12 rounded shadow-sm"
          />
          <div>
            <h2 className="text-2xl font-bold">{info.destinationNameHebrew}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {info.countryNameHebrew}
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          רענן מידע
        </button>
      </div>

      {/* At a Glance */}
      <section>
        <h3 className="mb-3 text-lg font-semibold">מבט מהיר</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "בירה", value: info.atAGlance.capital, icon: "🏛️" },
            { label: "אוכלוסיה", value: info.atAGlance.population, icon: "👥" },
            { label: "שפות", value: info.atAGlance.languages, icon: "🗣️" },
            { label: "מטבע", value: info.atAGlance.currency, icon: "💰" },
            { label: "שער חליפין", value: info.atAGlance.exchangeRate, icon: "💱" },
            { label: "אזור זמן", value: info.atAGlance.timezone, icon: "🕐" },
            { label: "חשמל", value: info.atAGlance.electricPlug, icon: "🔌" },
            { label: "חירום", value: info.atAGlance.emergencyNumber, icon: "🚨" },
            { label: "טיפים", value: info.atAGlance.tippingCustoms, icon: "💵" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              <p className="mt-1 text-sm font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Good to Know */}
      <section>
        <h3 className="mb-3 text-lg font-semibold">טוב לדעת</h3>
        <div className="flex flex-col gap-3">
          {info.goodToKnow.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <h4 className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                {item.title}
              </h4>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {item.content}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Kids Corner */}
      <section>
        <h3 className="mb-3 text-lg font-semibold">
          <span className="ml-2">🧒</span>
          פינת הילדים
        </h3>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <h4 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
            עובדות מעניינות
          </h4>
          <ul className="flex flex-col gap-2">
            {info.kidsCorner.funFacts.map((fact, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
                <span className="mt-0.5 text-amber-500">✦</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
          <h4 className="mb-2 text-sm font-semibold text-purple-800 dark:text-purple-200">
            {info.kidsCorner.story.title}
          </h4>
          <p className="text-sm leading-relaxed text-purple-900 dark:text-purple-100">
            {info.kidsCorner.story.content}
          </p>
        </div>
      </section>

      {/* Map */}
      {info.coordinates && (
        <section>
          <h3 className="mb-3 text-lg font-semibold">מפה</h3>
          <DestinationMap
            center={info.coordinates}
            destinationName={info.destinationNameHebrew}
          />
        </section>
      )}

      {/* Tourist Dictionary */}
      <section>
        <h3 className="mb-3 text-lg font-semibold">מילון לתייר</h3>
        <div className="flex flex-col gap-4">
          {info.dictionary.map((cat, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700"
            >
              <div className="bg-zinc-100 px-4 py-2 dark:bg-zinc-800">
                <h4 className="text-sm font-semibold">{cat.category}</h4>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                    <th className="px-4 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                      עברית
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                      מקומית
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                      תעתיק
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cat.phrases.map((phrase, j) => (
                    <tr
                      key={j}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-700/50"
                    >
                      <td className="px-4 py-2">{phrase.hebrew}</td>
                      <td className="px-4 py-2 font-medium" dir="ltr">
                        {phrase.local}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                        {phrase.transliteration}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* Generated timestamp */}
      {info.generatedAt && (
        <p className="text-center text-xs text-zinc-400">
          נוצר ב-{new Date(info.generatedAt).toLocaleDateString("he-IL", {
            day: "numeric",
            month: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/components/trips/DestinationOverview.tsx
git commit -m "feat: add DestinationOverview component with all sections"
```

---

### Task 6: Integrate into TripDashboard

**Files:**
- Modify: `src/components/trips/TripDashboard.tsx`

**Step 1: Add import**

At top of file (after line 11), add:
```typescript
import { DestinationOverview } from "@/components/trips/DestinationOverview"
```

**Step 2: Add `destinationInfo` to Trip interface**

In the Trip interface (`TripDashboard.tsx:14-56`), add after `carRental`:
```typescript
  destinationInfo: any | null
```

**Step 3: Update tabs array**

Replace the tabs array (`TripDashboard.tsx:58-64`):
```typescript
const tabs = [
  { key: "overview", label: "סקירה כללית" },
  { key: "destination", label: "יעד" },
  { key: "attractions", label: "אטרקציות" },
  { key: "restaurants", label: "מסעדות" },
  { key: "schedule", label: 'לו"ז' },
  { key: "lists", label: "רשימות" },
] as const
```

**Step 4: Add tab content rendering**

After line 891 (`{activeTab === "overview" && <OverviewTab trip={trip} onUpdated={refreshTrip} />}`), add:
```typescript
      {activeTab === "destination" && (
        <DestinationOverview
          tripId={trip.id}
          destination={trip.destination}
          destinationInfo={trip.destinationInfo}
          onGenerated={refreshTrip}
        />
      )}
```

**Step 5: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 6: Commit**

```bash
git add src/components/trips/TripDashboard.tsx
git commit -m "feat: add destination tab to TripDashboard"
```

---

### Task 7: Update API route with geocoding

**Files:**
- Modify: `src/app/api/trips/[tripId]/destination/route.ts`

**Step 1: Add geocoding to the API route**

Add import at top:
```typescript
import { geocodeAddress } from "@/lib/google-maps"
```

After `const info = await generateDestinationInfo(trip.destination)`, add:
```typescript
    const coords = await geocodeAddress(trip.destination)
    if (coords) {
      (info as any).coordinates = coords
    }
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/api/trips/\[tripId\]/destination/route.ts
git commit -m "feat: add geocoding to destination info for map"
```

---

### Task 8: Verify end-to-end

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Manual testing checklist**
- Open a trip with a destination → click "יעד" tab → content auto-generates
- Verify: flag image loads from flagcdn.com
- Verify: all 6 sections render with Hebrew content
- Verify: map shows country-level view with pin
- Verify: dictionary table renders with 3 columns
- Click "רענן מידע" → new content generated
- Reload page → cached content loads instantly (no re-generation)
- Check dark mode rendering
- Test with a trip that has no destination → should show error gracefully

**Step 3: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds, `/api/trips/[tripId]/destination` appears in routes.

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues from destination overview testing"
```
