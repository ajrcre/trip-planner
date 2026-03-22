# Itinerary Details & Interactive Map Design

**Date**: 2026-03-22

## Overview

Enhance itinerary activity cards with collapsible place details (address, phone, website, Google Maps link, opening hours with time conflict warnings), add lodging as a first-class activity type, and display an interactive Google Map alongside the timeline showing locations and routes.

## 1. Collapsible Activity Details

ActivityCard gets an expandable details section for attraction/restaurant activities.

**Collapsed (default)**: Current view — name, time, notes, driving time from lodging.

**Expanded** (via chevron toggle):
- **Address** — plain text
- **Phone** — clickable `tel:` link
- **Website** — clickable external link, truncated display
- **Google Maps link** — "View on Google Maps" → `https://www.google.com/maps/place/?q=place_id:{googlePlaceId}`
- **Opening hours** — today's hours prominently (e.g., "Open today: 9:00 AM – 6:00 PM"), secondary expand for full weekly schedule
- **Time conflict warning** — amber badge if `timeStart` is before opening or `timeEnd` is after closing (e.g., "Opens at 9:00 AM — you arrive at 8:30 AM")

**Data flow**: Schedule API expands attraction/restaurant includes to return address, phone, website, googlePlaceId, openingHours, lat, lng (currently only returns `{id, name}`).

## 2. Lodging as Activity Type

New activity type `"lodging"` alongside existing types (attraction, meal, travel, rest, custom, flights, car_rental).

### Auto-insertion
When day plans are generated (POST `/api/trips/[tripId]/schedule`):
- **Start of day**: lodging activity at ~09:00 (or check-out time on departure day)
- **End of day**: lodging activity at ~21:00 (or check-in time on arrival day)
- Uses accommodation for that day via `getAccommodationsForDay()`

### Manual add
"Add Activity" menu gets a "Lodging" option that auto-fills from the trip's accommodation for that day. User picks the time.

### Data
- Uses existing `type` field with value `"lodging"`
- Accommodation name stored in `notes`
- Coordinates derived from trip accommodation data
- No schema changes needed

### Display
- Home/bed icon
- Accommodation name
- Participates in map route rendering like any other activity

## 3. Interactive Map Component

New `ItineraryMap` component using `@vis.gl/react-google-maps`.

### Layout (RTL)
- **Desktop**: Map on left (~45%), timeline on right (~55%), map is sticky
- **Mobile**: Timeline on top, map below
- **Collapse toggle**: Button to minimize map; desktop → timeline goes full width; mobile → map collapses to thin bar with "Show Map"

### Map Features
- **Markers**: Numbered, chronologically ordered, color-coded by type (lodging=blue, attraction=orange, meal=red, etc.)
- **Routes**: Driving route polylines connecting activities in order (1 → 2 → 3) via Google Maps JS API Directions Service
- **Info windows**: Click marker → popup with place name, time, type
- **Auto-fit**: Bounds adjust to fit all markers for the active day

### Day/Trip Toggle
- Default: current day's activities
- Toggle: "All days" with markers color-coded by day

### Bidirectional Interaction
- Click map marker → highlight and scroll to activity in timeline
- Click/hover activity in timeline → highlight marker on map

### Route Caching
Routes fetched client-side when day activities change; polyline data cached to avoid redundant API calls.

## 4. API Changes

### Schedule GET (`/api/trips/[tripId]/schedule`)
Expand attraction/restaurant includes:
```
select: { id, name, address, phone, website, googlePlaceId, openingHours, lat, lng }
```

### Schedule POST (`/api/trips/[tripId]/schedule`)
Auto-insert lodging activities at start/end of each day using trip accommodation data.

### No new endpoints
Map routes use browser-side Google Maps JS API Directions Service — no backend proxy needed.

## Technical Stack
- **Map library**: `@vis.gl/react-google-maps` (official Google React wrapper)
- **Existing infra**: Google Maps API key already configured for Places/Routes APIs
