# Trip Planner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a family trip planning web app that automates research using real APIs (Google Places, Routes, TripAdvisor) and presents an interactive planning experience.

**Architecture:** Next.js full-stack app with PostgreSQL (Prisma ORM), Google login via NextAuth, external API integrations for accurate data, and Claude API for AI-assisted recommendations. Hebrew RTL interface.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma, PostgreSQL (Neon free tier), NextAuth.js, Google Maps/Places/Routes APIs, TripAdvisor API, Claude API, Tailwind CSS, Vercel.

**Design doc:** `docs/plans/2026-03-21-trip-planner-design.md`

---

## Phase 1: Project Foundation

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.env.example`

**Step 1: Scaffold Next.js with TypeScript + Tailwind**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 2: Add RTL support to root layout**

In `src/app/layout.tsx`, set `<html lang="he" dir="rtl">` and add Heebo font (Hebrew-friendly Google Font).

**Step 3: Create `.env.example`**

```env
# Database
DATABASE_URL=postgresql://...

# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Google Maps Platform
GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_CLIENT_KEY=

# TripAdvisor
TRIPADVISOR_API_KEY=

# Claude
ANTHROPIC_API_KEY=
```

**Step 4: Verify dev server runs**

```bash
npm run dev
```
Expected: App loads at localhost:3000 in RTL Hebrew layout.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with RTL Hebrew support"
```

---

### Task 2: Database Schema + Prisma Setup

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json` (add prisma deps)

**Step 1: Install Prisma**

```bash
npm install prisma @prisma/client
npx prisma init
```

**Step 2: Write the full Prisma schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// === Auth (NextAuth) ===
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  familyProfile FamilyProfile?
  trips         Trip[]
  sharedTrips   TripShare[]
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// === Family Profile ===
model FamilyProfile {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Preferences (stored as JSON for flexibility)
  attractionTypes    String[]  @default([])
  foodPreferences    String[]  @default([])
  noLayovers         Boolean   @default(true)
  preferredFlightStart String? // e.g. "08:00"
  preferredFlightEnd   String? // e.g. "22:00"
  pace               String    @default("moderate") // relaxed | moderate | intensive

  members FamilyMember[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model FamilyMember {
  id              String        @id @default(cuid())
  familyProfileId String
  familyProfile   FamilyProfile @relation(fields: [familyProfileId], references: [id], onDelete: Cascade)

  name         String
  dateOfBirth  DateTime
  role         String   // parent | child | other_adult
  specialNeeds String[] @default([]) // stroller, car_seat_booster, etc.

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// === Trip ===
model Trip {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String
  destination String
  startDate   DateTime
  endDate     DateTime

  // Accommodation (JSON for flexible structure)
  accommodation Json? // { name, address, lat, lng, checkIn, checkOut, contact, bookingDetails, nearbySupermarkets[] }

  // Flights (JSON)
  flights Json? // { outbound: { flightNumber, departure, arrival, ... }, return: { ... } }

  // Car rental (JSON)
  carRental Json? // { company, pickup, return, vehicles[], drivers[], insurance, childSeats[] }

  attractions  Attraction[]
  restaurants  Restaurant[]
  dayPlans     DayPlan[]
  packingItems PackingItem[]
  shoppingItems ShoppingItem[]
  shares       TripShare[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model TripShare {
  id     String @id @default(cuid())
  tripId String
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   String @default("viewer") // viewer | editor

  @@unique([tripId, userId])
}

// === Attraction ===
model Attraction {
  id     String @id @default(cuid())
  tripId String
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)

  googlePlaceId String?
  name          String
  description   String?  @db.Text
  address       String?
  lat           Float?
  lng           Float?
  phone         String?
  website       String?

  openingHours  Json?    // { regular: {...}, seasonal: [...] }
  prices        Json?    // { adult, child, family, notes }
  photos        String[] @default([])

  ratingGoogle      Float?
  ratingTripadvisor Float?

  travelTimeMinutes Int?   // from accommodation
  travelDistanceKm  Float?

  nearbyRestaurantId String?
  bookingRequired    Boolean @default(false)

  kidFriendlyScore     Int?     // 1-5
  kidFriendlyReasoning String?  @db.Text
  specialNotes         String?  @db.Text

  status String @default("maybe") // want | maybe | rejected

  dataLastUpdated DateTime?
  dataSource      String?

  activities Activity[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// === Restaurant ===
model Restaurant {
  id     String @id @default(cuid())
  tripId String
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)

  googlePlaceId String?
  name          String
  cuisineType   String?
  address       String?
  lat           Float?
  lng           Float?
  phone         String?
  website       String?

  openingHours Json? // regular schedule

  ratingGoogle      Float?
  ratingTripadvisor Float?

  travelTimeMinutes Int?
  kidFriendly       Boolean @default(false)
  photos            String[] @default([])

  status String @default("maybe") // want | maybe | rejected

  dataLastUpdated DateTime?
  dataSource      String?

  activities Activity[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// === Day Plan ===
model DayPlan {
  id     String @id @default(cuid())
  tripId String
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)

  date     DateTime
  dayType  String   // arrival | departure | full_day
  isLocked Boolean  @default(false)

  activities Activity[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tripId, date])
}

model Activity {
  id        String  @id @default(cuid())
  dayPlanId String
  dayPlan   DayPlan @relation(fields: [dayPlanId], references: [id], onDelete: Cascade)

  sortOrder  Int
  timeStart  String? // "09:00"
  timeEnd    String? // "12:00"
  type       String  // attraction | meal | travel | rest | custom
  notes      String? @db.Text

  attractionId String?
  attraction   Attraction? @relation(fields: [attractionId], references: [id])
  restaurantId String?
  restaurant   Restaurant? @relation(fields: [restaurantId], references: [id])

  travelTimeToNextMinutes Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// === Lists ===
model PackingItem {
  id     String @id @default(cuid())
  tripId String
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)

  category String  // flight | general | electronics | medicine | clothes
  item     String
  checked  Boolean @default(false)
  forMember String? // specific family member or null for shared

  sortOrder Int @default(0)
}

model ShoppingItem {
  id     String @id @default(cuid())
  tripId String
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)

  category String  // dairy | meat | carbs | fruits | vegetables | other
  item     String
  checked  Boolean @default(false)

  sortOrder Int @default(0)
}
```

**Step 3: Generate Prisma client and push schema**

```bash
npx prisma generate
npx prisma db push
```
Expected: Schema synced to database, client generated.

**Step 4: Create Prisma client singleton**

Create `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Step 5: Commit**

```bash
git add prisma/ src/lib/prisma.ts package.json package-lock.json
git commit -m "feat: add Prisma schema with full data model"
```

---

### Task 3: Authentication with NextAuth + Google

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/auth.ts`
- Create: `src/components/auth/LoginButton.tsx`
- Modify: `src/app/layout.tsx` (add SessionProvider)

**Step 1: Install NextAuth**

```bash
npm install next-auth @auth/prisma-adapter
```

**Step 2: Configure NextAuth**

Create `src/lib/auth.ts`:
```typescript
import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session: async ({ session, user }) => {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
}
```

Create `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

**Step 3: Add SessionProvider to layout**

Create `src/components/providers/SessionProvider.tsx` (client component wrapping next-auth).
Update `src/app/layout.tsx` to wrap children with SessionProvider.

**Step 4: Create LoginButton component**

Simple component using `signIn("google")` and `signOut()`.

**Step 5: Update home page with login**

Show login button if not authenticated, show "My Trips" if authenticated.

**Step 6: Test login flow manually**

```bash
npm run dev
```
Expected: Google login works, session persists, user created in DB.

**Step 7: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/components/ src/app/layout.tsx src/app/page.tsx package.json package-lock.json
git commit -m "feat: add Google authentication with NextAuth"
```

---

## Phase 2: Family Profile

### Task 4: Family Profile API + UI

**Files:**
- Create: `src/app/api/family/route.ts`
- Create: `src/app/api/family/members/route.ts`
- Create: `src/app/family/page.tsx`
- Create: `src/components/family/FamilyProfileForm.tsx`
- Create: `src/components/family/MemberCard.tsx`

**Step 1: Create Family Profile API routes**

`GET /api/family` — returns current user's family profile with members
`PUT /api/family` — updates preferences (attraction types, food, pace, flight constraints)

`POST /api/family/members` — add a family member
`PUT /api/family/members/[id]` — update a member
`DELETE /api/family/members/[id]` — remove a member

**Step 2: Create Family Profile page**

Page at `/family` with:
- List of family members with name, age (calculated from DOB), role, special needs
- "Add member" form
- Edit/delete each member
- Preferences section: attraction types (multi-select chips), food preferences, flight constraints, pace slider

**Step 3: Auto-create profile on first visit**

If user has no FamilyProfile, create one with defaults when they visit `/family`.

**Step 4: Test manually**

Add 2-3 family members, set preferences, verify data persists on reload.

**Step 5: Commit**

```bash
git add src/app/api/family/ src/app/family/ src/components/family/
git commit -m "feat: add family profile management (members + preferences)"
```

---

## Phase 3: Trip CRUD

### Task 5: Trip Creation + Dashboard

**Files:**
- Create: `src/app/api/trips/route.ts`
- Create: `src/app/api/trips/[tripId]/route.ts`
- Create: `src/app/trips/page.tsx` (trip list)
- Create: `src/app/trips/new/page.tsx` (create trip)
- Create: `src/app/trips/[tripId]/page.tsx` (trip dashboard)
- Create: `src/components/trips/TripForm.tsx`
- Create: `src/components/trips/TripDashboard.tsx`

**Step 1: Create Trip API routes**

`GET /api/trips` — list user's trips
`POST /api/trips` — create a new trip
`GET /api/trips/[tripId]` — get trip with all relations
`PUT /api/trips/[tripId]` — update trip details
`DELETE /api/trips/[tripId]` — delete trip

**Step 2: Create Trip form page**

Form at `/trips/new` with fields:
- Trip name, destination, start date, end date
- Accommodation: name, address (with Google Places autocomplete later), check-in/out times, contact, booking ref
- Flights: outbound and return (flight number, departure/arrival times)
- Car rental: company, pickup/return details, vehicles

**Step 3: Create Trip list page**

`/trips` — grid of trip cards showing name, destination, dates, status.

**Step 4: Create Trip dashboard**

`/trips/[tripId]` — tabbed layout:
- Overview tab (summary + map placeholder)
- Attractions tab (empty for now)
- Restaurants tab (empty for now)
- Schedule tab (empty for now)
- Lists tab (empty for now)

**Step 5: Test trip CRUD**

Create a trip, verify it appears in the list, open dashboard, edit details.

**Step 6: Commit**

```bash
git add src/app/api/trips/ src/app/trips/ src/components/trips/
git commit -m "feat: add trip CRUD with dashboard shell"
```

---

## Phase 4: Google APIs Integration

### Task 6: Google Maps + Places API Service

**Files:**
- Create: `src/lib/google-maps.ts` (server-side Places/Routes client)
- Create: `src/lib/google-maps-client.ts` (client-side Maps JS loader)
- Create: `src/components/maps/TripMap.tsx`
- Create: `src/app/api/places/search/route.ts`
- Create: `src/app/api/places/[placeId]/route.ts`
- Create: `src/app/api/routes/route.ts`

**Step 1: Install Google Maps libraries**

```bash
npm install @googlemaps/js-api-loader
```

**Step 2: Create server-side Google API client**

`src/lib/google-maps.ts`:
- `searchPlaces(query, location, radius, type)` — calls Places API (New) Text Search
- `getPlaceDetails(placeId, fields)` — calls Place Details with field mask
- `calculateRoute(origin, destination)` — calls Routes API for travel time

Uses fetch with the server-side API key. Requests only needed fields to minimize cost.

Field masks per use case:
- Search results: `places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.photos,places.location`
- Full details: above + `places.regularOpeningHours,places.internationalPhoneNumber,places.websiteUri,places.editorialSummary,places.priceLevel`

**Step 3: Create API routes**

`POST /api/places/search` — proxy to Places text search (body: { query, lat, lng, radius, type })
`GET /api/places/[placeId]` — proxy to Place Details
`POST /api/routes` — proxy to Routes API (body: { origin: {lat, lng}, destination: {lat, lng} })

These routes:
- Require authentication
- Keep API keys server-side
- Cache results in DB when possible

**Step 4: Create client-side map component**

`src/components/maps/TripMap.tsx`:
- Loads Google Maps JS API
- Shows accommodation marker
- Shows attraction/restaurant markers with color coding
- Radius circle showing drive time zones

**Step 5: Integrate map into trip dashboard Overview tab**

Show accommodation and all saved attractions/restaurants on the map.

**Step 6: Test with real API calls**

Search for "attractions near Porto Heli Greece", verify results include real opening hours and ratings.
Calculate route from Porto Heli to Athens airport, verify realistic travel time.

**Step 7: Commit**

```bash
git add src/lib/google-maps*.ts src/components/maps/ src/app/api/places/ src/app/api/routes/
git commit -m "feat: integrate Google Places + Routes APIs with map component"
```

---

## Phase 5: Attraction Discovery

### Task 7: Attraction Search + Discovery UI

**Files:**
- Create: `src/app/api/trips/[tripId]/attractions/route.ts`
- Create: `src/app/api/trips/[tripId]/attractions/[id]/route.ts`
- Create: `src/app/api/trips/[tripId]/attractions/discover/route.ts`
- Create: `src/components/attractions/DiscoveryPanel.tsx`
- Create: `src/components/attractions/AttractionCard.tsx`
- Create: `src/components/attractions/AttractionTable.tsx`
- Create: `src/components/attractions/AttractionFilters.tsx`

**Step 1: Create attraction discovery API**

`POST /api/trips/[tripId]/attractions/discover`:
1. Takes: { query?, types?, radius? }
2. Gets accommodation coordinates from trip
3. Searches Google Places within radius
4. For each result, fetches full details (hours, phone, website, photos)
5. Calculates travel time from accommodation via Routes API
6. Returns enriched results

`POST /api/trips/[tripId]/attractions` — save an attraction to the trip (from discovery)
`PUT /api/trips/[tripId]/attractions/[id]` — update status, notes
`DELETE /api/trips/[tripId]/attractions/[id]` — remove

**Step 2: Create AttractionCard component**

Card showing:
- Photo (from Google Places)
- Name + description
- Rating (stars) + review count
- Travel time from accommodation (badge)
- Opening hours (with seasonal warning if applicable)
- "Want" / "Maybe" / "Reject" buttons
- Expand for full details (phone, address, website, prices)

**Step 3: Create DiscoveryPanel**

Discovery interface:
- Search bar + filter chips (type: nature, museum, park, beach, etc.)
- Map with results plotted
- Scrollable card list
- Radius selector (15/30/45/60 min drive)

**Step 4: Create AttractionTable**

Table view (matching the user's existing format) for saved attractions:
- Columns: Name, Description, Address, Phone, Hours, Prices, Notes, Travel Time, Nearby Restaurant, Website, Booking Required
- Status filter: Want / Maybe / All
- Sortable by travel time, rating

**Step 5: Wire into trip dashboard Attractions tab**

Two views:
- "Discover" — search and add new attractions
- "My Attractions" — table of saved attractions

**Step 6: Test end-to-end**

Create a trip with Porto Heli accommodation, discover attractions, save 5-6 to trip, verify table displays correctly with real data.

**Step 7: Commit**

```bash
git add src/app/api/trips/*/attractions/ src/components/attractions/
git commit -m "feat: add attraction discovery with Google Places + travel times"
```

---

## Phase 6: Restaurant Discovery

### Task 8: Restaurant Search + Discovery UI

**Files:**
- Create: `src/app/api/trips/[tripId]/restaurants/route.ts`
- Create: `src/app/api/trips/[tripId]/restaurants/[id]/route.ts`
- Create: `src/app/api/trips/[tripId]/restaurants/discover/route.ts`
- Create: `src/components/restaurants/DiscoveryPanel.tsx`
- Create: `src/components/restaurants/RestaurantCard.tsx`
- Create: `src/components/restaurants/RestaurantTable.tsx`

**Step 1: Create restaurant discovery API**

Same pattern as attractions but with restaurant-specific fields:
- Cuisine type from Google Places categories
- Price level
- Filter by cuisine type

**Step 2: Create Restaurant UI components**

Same pattern as attractions: Card, DiscoveryPanel, Table.
Table columns: Name, Cuisine, Address, Phone, Hours, Travel Time, Rating.

**Step 3: Link restaurants to nearby attractions**

When viewing an attraction, show nearby restaurants (within 10 min drive).
Allow user to link a restaurant as the "nearby restaurant" for an attraction.

**Step 4: Wire into trip dashboard Restaurants tab**

**Step 5: Test**

Search restaurants near Porto Heli, save some, link to attractions.

**Step 6: Commit**

```bash
git add src/app/api/trips/*/restaurants/ src/components/restaurants/
git commit -m "feat: add restaurant discovery with linking to attractions"
```

---

## Phase 7: Schedule Builder

### Task 9: Day Plan API + Schedule UI

**Files:**
- Create: `src/app/api/trips/[tripId]/schedule/route.ts`
- Create: `src/app/api/trips/[tripId]/schedule/generate/route.ts`
- Create: `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts`
- Create: `src/components/schedule/ScheduleView.tsx`
- Create: `src/components/schedule/DayTimeline.tsx`
- Create: `src/components/schedule/ActivityCard.tsx`

**Step 1: Create schedule generation API**

`POST /api/trips/[tripId]/schedule/generate`:
1. Creates DayPlan entries for each day of the trip
2. First day: marks as "arrival", adds flight arrival, travel to accommodation
3. Last day: marks as "departure", adds travel to airport, flight
4. Middle days: suggests grouping based on:
   - Attraction proximity (cluster nearby attractions together)
   - Opening hours (museums on rainy days, outdoor on sunny)
   - Travel time optimization (minimize daily driving)
5. Calculates travel times between consecutive stops using Routes API

**Step 2: Create DayTimeline component**

Visual timeline for a single day:
- Time column on the right (RTL)
- Activity cards stacked vertically
- Travel time indicators between activities
- Drag & drop to reorder (using @dnd-kit/sortable)
- "Add activity" button between slots

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 3: Create ScheduleView**

Full schedule view:
- Horizontal day tabs or swipeable day cards
- Each day shows its DayTimeline
- Color coding: arrival/departure days (more rigid) vs. full days (flexible)
- "Auto-generate schedule" button

**Step 4: Create Activity CRUD**

- Add activity (pick from saved attractions/restaurants, or custom)
- Set time start/end
- Reorder via drag & drop
- Remove activity
- Auto-calculate travel time when activity order changes

**Step 5: Test**

Create schedule for a Porto Heli trip, verify first/last day have flight times, verify travel times between activities are realistic.

**Step 6: Commit**

```bash
git add src/app/api/trips/*/schedule/ src/components/schedule/
git commit -m "feat: add schedule builder with drag-and-drop and auto-generation"
```

---

## Phase 8: Lists

### Task 10: Packing + Shopping Lists

**Files:**
- Create: `src/app/api/trips/[tripId]/packing/route.ts`
- Create: `src/app/api/trips/[tripId]/shopping/route.ts`
- Create: `src/components/lists/PackingList.tsx`
- Create: `src/components/lists/ShoppingList.tsx`
- Create: `src/lib/list-templates.ts` (default templates based on user's examples)

**Step 1: Create default list templates**

Based on the user's existing lists from the Salzburg and Greece trips, create sensible default templates:

```typescript
// src/lib/list-templates.ts
export const defaultPackingTemplate = [
  { category: "flight", items: ["passports", "printed_booking_confirmations", "cash_local", "cash_ils", "credit_cards", "disability_card"] },
  { category: "general", items: ["backpacks", "sunglasses", "wipes", "sanitizer", "tissues"] },
  { category: "electronics", items: ["phones_chargers", "tablet_charger", "kids_headphones", "splitter", "car_mount", "car_charger", "power_bank", "adapter"] },
  { category: "medicine", items: ["allergy_meds", "pain_relief_kids", "pain_relief_adults", "thermometer", "first_aid", "sunscreen"] },
  { category: "kids", items: ["stroller", "swim_floats", "swim_goggles", "toys_for_flight", "snacks_for_flight"] },
]

export const defaultShoppingTemplate = [
  { category: "dairy", items: ["milk", "yellow_cheese", "yogurt", "triangle_cheese", "butter"] },
  { category: "meat", items: ["sausage", "hot_dogs", "eggs"] },
  { category: "carbs", items: ["bread", "rolls", "pasta", "snacks", "pastries"] },
  { category: "fruits", items: ["green_apples", "grapes"] },
  { category: "vegetables", items: ["tomatoes", "cucumbers", "carrots", "onions"] },
  { category: "other", items: ["juice", "ketchup", "chocolate_spread", "pasta_sauce", "paper_towels", "oil", "beer"] },
]
```

**Step 2: Create list API routes**

CRUD for both packing and shopping items. Batch operations for toggling checked status.
`POST /api/trips/[tripId]/packing/init` — initialize from template with family-member-specific items.

**Step 3: Create list UI components**

Checklist grouped by category, with:
- Check/uncheck items
- Add custom items
- Delete items
- Progress indicator ("12/45 items packed")
- Auto-generate based on template + family profile (e.g., add child-specific items per member)

**Step 4: Wire into Lists tab**

Two sub-tabs: Packing / Shopping.

**Step 5: Test**

Initialize lists for a trip, check some items, add custom ones, verify persistence.

**Step 6: Commit**

```bash
git add src/app/api/trips/*/packing/ src/app/api/trips/*/shopping/ src/components/lists/ src/lib/list-templates.ts
git commit -m "feat: add packing and shopping lists with templates"
```

---

## Phase 9: AI Assistant Integration

### Task 11: Claude API Integration

**Files:**
- Create: `src/lib/claude.ts`
- Create: `src/app/api/ai/suggest/route.ts`
- Create: `src/components/ai/AiAssistant.tsx`

**Step 1: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

**Step 2: Create Claude service**

`src/lib/claude.ts`:
- `suggestAttractions(destination, familyProfile, existingAttractions)` — suggests attractions based on family, avoiding duplicates
- `assessKidFriendliness(placeName, reviews)` — analyzes reviews for kid-friendliness
- `suggestScheduleFill(dayPlan, availableAttractions, timeSlot)` — suggests what fits in a time gap
- `generateTripSummary(trip)` — creates a text summary for export

All functions include system prompt that explicitly states: "You are helping plan a trip. Provide suggestions and recommendations only. Do NOT generate factual data like opening hours, prices, or travel times — those come from verified APIs."

**Step 3: Create AI suggestion API route**

`POST /api/ai/suggest` — takes context (trip, family, question) and returns Claude's suggestion.

**Step 4: Create AiAssistant component**

Small chat-like interface that appears in the schedule view:
- User types: "I have 3 hours Tuesday afternoon, what should we do?"
- Claude responds with suggestions from the saved attractions list
- User can one-click add a suggestion to the schedule

**Step 5: Add AI badge to AI-generated content**

All content from Claude gets a small "AI" badge in the UI to distinguish from API-verified data.

**Step 6: Test**

Ask Claude for suggestions for a Porto Heli trip with 2 toddlers, verify it gives relevant ideas and doesn't hallucinate hours/prices.

**Step 7: Commit**

```bash
git add src/lib/claude.ts src/app/api/ai/ src/components/ai/
git commit -m "feat: integrate Claude API for trip suggestions and schedule assistance"
```

---

## Phase 10: Sharing + Export

### Task 12: Share with Family + Google Doc Export

**Files:**
- Create: `src/app/api/trips/[tripId]/share/route.ts`
- Create: `src/app/api/trips/[tripId]/export/route.ts`
- Create: `src/app/shared/[token]/page.tsx`
- Create: `src/lib/export-gdoc.ts`

**Step 1: Create sharing system**

- Generate unique share link per trip
- Share link opens read-only view (no auth required for viewing)
- Optional: invite family members by email (they need Google login for edit access)

**Step 2: Create shared trip view**

`/shared/[token]` — public page showing trip details:
- Overview with map
- Daily schedule
- Attraction and restaurant tables
- Google Maps navigation links for each place

**Step 3: Create Google Doc export**

`src/lib/export-gdoc.ts`:
- Generates a structured document matching the user's existing format
- Sections: Flight details, Accommodation, Car rental, Daily schedule, Attractions table, Restaurants list, Packing list, Shopping list
- Uses Google Docs API to create the doc in user's Drive

```bash
npm install googleapis
```

Alternative (simpler v1): export as DOCX file download using the docx npm package (already available in the skill).

**Step 4: Add share + export buttons to trip dashboard**

**Step 5: Test**

Export a trip to Google Doc, verify format matches the user's existing examples.
Share a trip link, open in incognito, verify read-only view works.

**Step 6: Commit**

```bash
git add src/app/api/trips/*/share/ src/app/api/trips/*/export/ src/app/shared/ src/lib/export-gdoc.ts
git commit -m "feat: add trip sharing and Google Doc export"
```

---

## Phase Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | Tasks 1-3 | Project setup, DB schema, auth |
| 2 | Task 4 | Family profile management |
| 3 | Task 5 | Trip CRUD + dashboard shell |
| 4 | Task 6 | Google APIs integration + maps |
| 5 | Task 7 | Attraction discovery |
| 6 | Task 8 | Restaurant discovery |
| 7 | Task 9 | Schedule builder |
| 8 | Task 10 | Packing + shopping lists |
| 9 | Task 11 | Claude AI assistant |
| 10 | Task 12 | Sharing + export |

**Recommended execution order:** Sequential (1 → 10). Each phase builds on the previous. The app becomes usable after Phase 5 (you can search and save attractions) and improves with each subsequent phase.

**After Phase 7** the app covers the core workflow end-to-end. Phases 8-10 are enhancements.
