# Trip Planner - Design Document

## Problem

Planning family trips abroad is a repetitive, manual process that involves:
- Researching attractions, restaurants, and logistics across multiple sources
- Manually compiling details (hours, prices, addresses, phone numbers) into tables
- Calculating travel times (often getting inaccurate results from LLMs)
- Building daily schedules that account for opening hours, travel times, and family constraints
- Organizing everything into a shareable document

Key pain points:
1. **Time-consuming research** - hours spent gathering and cross-referencing information
2. **Inaccurate data from LLMs** - models hallucinate opening hours, travel times, and prices
3. **Manual organization** - copying data between sources into structured tables

## Solution

A web application that automates trip research and planning while ensuring data accuracy by using real APIs (not LLM-generated facts). The app is interactive - the user drives decisions, the system does the legwork.

## Users

- Primary: Shahar (trip planner)
- Secondary: Family members (view schedule, see details)
- Family profile stored persistently across trips

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js (React) + TypeScript |
| Backend | Next.js API Routes |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js (Google login) |
| External APIs | Google Places, Google Routes, TripAdvisor, Claude API |
| Hosting | Vercel (free tier) |
| Maps | Google Maps JavaScript API (embedded) |
| Language | Hebrew (RTL) |

## Data Model

### FamilyProfile (persistent across trips)
```
FamilyProfile
  ├── members[]
  │   ├── name: string
  │   ├── date_of_birth: date (age calculated automatically per trip)
  │   ├── role: "parent" | "child" | "other_adult"
  │   └── special_needs: string[] (stroller, car seat type, mobility)
  ├── preferences
  │   ├── attraction_types: string[] (nature, museums, amusement parks, beaches...)
  │   ├── food_preferences: string[] (allergies, kosher, cuisine types)
  │   ├── flight_constraints: { no_layovers: bool, preferred_hours: range }
  │   └── pace: "relaxed" | "moderate" | "intensive"
  └── car_requirements
      ├── num_cars_needed: number (auto-calculated from member count)
      └── child_seats: { type: string, for_member: ref }[]
```

### Trip
```
Trip
  ├── name: string
  ├── destination: string
  ├── dates: { start: date, end: date }
  ├── accommodation
  │   ├── name, address, coordinates
  │   ├── check_in, check_out
  │   ├── booking_details, contact
  │   └── nearby_supermarkets[]
  ├── flights
  │   ├── outbound: { flight_number, departure, arrival, times }
  │   └── return: { flight_number, departure, arrival, times }
  ├── car_rental
  │   ├── company, pickup_location, return_location
  │   ├── vehicles[], drivers[]
  │   └── insurance, child_seats
  ├── attractions[]  → Attraction
  ├── restaurants[]  → Restaurant
  ├── day_plans[]    → DayPlan
  ├── packing_list   → PackingList
  ├── shopping_list  → ShoppingList
  └── shared_with: user_id[] (family access)
```

### Attraction
```
Attraction
  ├── google_place_id: string (source of truth)
  ├── name, description: string
  ├── address, coordinates: string
  ├── phone, website: string
  ├── opening_hours: { regular: schedule, seasonal: schedule[] }
  ├── prices: { adult, child, family, notes }
  ├── photos: url[]
  ├── rating: { google: number, tripadvisor: number }
  ├── travel_time_from_accommodation: { duration: minutes, distance: km }
  ├── nearby_restaurant: ref → Restaurant
  ├── booking_required: boolean
  ├── kid_friendly_assessment: { score, reasoning, source: "ai" }
  ├── special_notes: string
  ├── status: "want" | "maybe" | "rejected"
  └── data_freshness: { last_updated: date, source: string }
```

### Restaurant
```
Restaurant
  ├── google_place_id: string
  ├── name, cuisine_type: string
  ├── address, coordinates: string
  ├── phone, website: string
  ├── opening_hours: schedule
  ├── rating: { google: number, tripadvisor: number }
  ├── travel_time_from_accommodation: { duration: minutes }
  ├── kid_friendly: boolean
  ├── photos: url[]
  ├── status: "want" | "maybe" | "rejected"
  └── data_freshness: { last_updated: date, source: string }
```

### DayPlan
```
DayPlan
  ├── date: date
  ├── type: "arrival" | "departure" | "full_day"
  ├── activities[]
  │   ├── time_start, time_end: time
  │   ├── type: "attraction" | "meal" | "travel" | "rest" | "custom"
  │   ├── ref: Attraction | Restaurant | null
  │   ├── travel_time_to_next: minutes
  │   └── notes: string
  └── is_locked: boolean (arrival/departure days are more fixed)
```

## User Flow

### Step 1 - Create Trip
User enters: trip name, destination, dates, accommodation address.
Optional: flight details, car rental, accommodation details.

### Step 2 - Family Check
System shows current family profile, user confirms or updates for this trip.
Auto-calculates: children's ages at trip time, car seats needed, pricing categories.

### Step 3 - Discover Attractions (Interactive)
1. System searches attractions within 60-minute drive radius from accommodation
2. Displays cards: photo, name, description, rating, travel time, opening hours
3. User classifies each: "want" / "maybe" / "not interested"
4. User can search manually or ask Claude for targeted suggestions (e.g., "activities for toddlers")
5. Travel times calculated via Google Routes API (real, traffic-aware)

### Step 4 - Discover Restaurants (Same Pattern)
Search, filter by cuisine/distance/rating, classify, link to nearby attractions.

### Step 5 - Build Schedule
1. System proposes initial schedule based on:
   - Selected attractions and their opening hours (season-adjusted for trip dates)
   - Real travel times between stops
   - First/last day: precise schedule around flights
   - Middle days: grouped nearby attractions with flexible options
2. User drags, moves, adjusts - fully interactive
3. Claude assists with: "I have 3 free hours Tuesday afternoon, what fits?"

### Step 6 - Lists
- Packing list: base template (from user's history) + destination-specific items
- Shopping list: editable checklist

### Step 7 - Share & Export
- Share link for family (read-only or edit)
- Export to Google Doc (matching current format)
- Direct Google Maps navigation links for every place

## Data Accuracy Strategy

**Core principle: LLM never provides factual data. Only APIs do.**

| Data | Primary Source | Secondary Source | Verification |
|------|---------------|-----------------|-------------|
| Opening hours | Google Places API | Official website (scrape) | Cross-reference + seasonal flag |
| Travel times | Google Routes API (traffic-aware) | - | Calculated per time-of-day |
| Prices | Google Places + official site | TripAdvisor | "Last updated" timestamp shown |
| Ratings | Google Places | TripAdvisor | Show both ratings |
| Phone/address | Google Places | - | Place ID ensures accuracy |
| Description/recommendation | Claude API | - | Clearly labeled "AI assessment" |
| Kid-friendliness | Claude API (review analysis) | - | Labeled as "estimate" |

### Reliability Labels in UI
- API-sourced data: no label (trusted)
- AI-generated content: "AI assessment" tag
- Stale data (>1 month): "may have changed" tag
- Seasonal opening hours: "verify on official site" tag + link

## API Costs (Estimated Monthly for Personal Use)

| API | Free Tier | Expected Usage | Cost |
|-----|-----------|---------------|------|
| Google Places | 10K calls/mo | ~500-1000/trip | $0 |
| Google Routes | 5K calls/mo | ~200-400/trip | $0 |
| Google Maps JS | 10K loads/mo | ~100-200/trip | $0 |
| TripAdvisor | 5K calls/mo | ~200-400/trip | $0 |
| Claude API | Pay per token | ~50-100 calls/trip | ~$1-3/trip |
| Vercel | Free tier | Personal use | $0 |
| PostgreSQL (Neon/Supabase) | Free tier | Small DB | $0 |

**Total estimated cost: ~$1-3 per trip** (only Claude API has real cost)

## Screens

1. **Home** - Trip list + "New Trip" button
2. **Trip Dashboard** - Central view with tabs: Overview, Attractions, Restaurants, Schedule, Lists
3. **Discovery** - Search interface with interactive map, radius circles, filter/swipe cards
4. **Day View** - Detailed daily timeline with drag & drop, travel times between stops
5. **Family Profile** - Member management, preferences, saved across trips

## Out of Scope (v1)

- Google Maps saved lists sync (no API available)
- Flight search/booking
- Accommodation search/booking
- Automatic price comparison
- Multi-language support (Hebrew only)
- Mobile native app (responsive web is sufficient)
