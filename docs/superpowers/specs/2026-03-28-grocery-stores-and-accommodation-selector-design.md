# Grocery Stores + Accommodation Selector

**Date:** 2026-03-28
**Status:** Approved

## Summary

Add grocery store search and management to the trip planner, following the existing restaurant/attraction patterns. Additionally, add an accommodation selector to all discovery panels so that search results and travel times are relative to a chosen accommodation when a trip has multiple accommodations.

## Part 1: Grocery Store Data Model

New `GroceryStore` Prisma model (simplified from Restaurant):

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| tripId | String | FK to Trip |
| googlePlaceId | String? | |
| name | String | |
| address | String? | |
| lat | Float? | |
| lng | Float? | |
| phone | String? | |
| website | String? | |
| openingHours | Json? | |
| photos | String[] | |
| ratingGoogle | Float? | |
| storeType | String? | e.g., supermarket, convenience, organic |
| travelTimeMinutes | Int? | |
| travelDistanceKm | Float? | |
| status | String | want / maybe / rejected, default "maybe" (matches Restaurant/Attraction) |
| dataLastUpdated | DateTime? | |
| dataSource | String? | |
| activities | Activity[] | Relation for schedule integration |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Index:** `@@index([tripId])` (consistent with Restaurant/Attraction).

**Schema changes required on other models:**
- **Trip model:** Add `groceryStores GroceryStore[]` relation field.
- **Activity model:** Add optional `groceryStoreId String?` FK and `groceryStore GroceryStore?` relation (mirrors `restaurantId`/`attractionId`).

## Part 2: API Routes

### New Grocery Store Routes

- **`POST /api/trips/[tripId]/grocery-stores/discover`** — Search for grocery stores via Google Places. Accepts `{ query?, types[], radius?, accommodationId? }`. Uses selected accommodation's coordinates for location bias and travel time calculation.
- **`GET /api/trips/[tripId]/grocery-stores`** — List all saved grocery stores for the trip.
- **`POST /api/trips/[tripId]/grocery-stores`** — Save a discovered grocery store with storeType, travel time, etc.
- **`PUT /api/trips/[tripId]/grocery-stores/[id]`** — Update status or storeType.
- **`DELETE /api/trips/[tripId]/grocery-stores/[id]`** — Delete a grocery store.

**Note:** URL paths use kebab-case (`grocery-stores`) per URL conventions, while the Prisma model uses PascalCase (`GroceryStore`).

### Modified Existing Routes

- **`POST /api/trips/[tripId]/restaurants/discover`** — Add optional `accommodationId` parameter. When provided, use that accommodation's coordinates instead of defaulting to the first.
- **`POST /api/trips/[tripId]/attractions/discover`** — Same `accommodationId` addition.

## Part 3: Accommodation Selector in Discovery Panels

- Add an accommodation dropdown at the top of each discovery panel (restaurants, attractions, grocery stores).
- Only visible when the trip has 2+ accommodations.
- Defaults to the first accommodation.
- Affects:
  - Location bias for search queries (searches near selected accommodation).
  - Travel time/distance calculated for each discovery result.
- Does NOT recalculate travel times for already-saved items — they retain the values from when they were discovered.
- Implementation: The generic `DiscoveryPanel<T>` receives an optional `accommodations` prop (added to `DiscoveryPanelProps<T>`). When present with 2+ items, it renders the selector above the search bar. The selected accommodation's ID is included in the fetch body as `accommodationId` alongside the existing `query` field in `handleSearch`.

## Part 4: UI Components

### GroceryStoreCard
- Wraps generic `ItemCard`.
- Green gradient header (differentiates from orange restaurants, blue attractions).
- Shows `storeType` in a green badge next to the name.

### GroceryStoreTable
- Wraps generic `ItemTable`.
- Custom store type column (green badge).
- Sort options: name, travel time, rating.
- Expanded row: address, phone, website, opening hours, status buttons.

### GroceryStoreDiscoveryPanel
- Wraps generic `DiscoveryPanel` with grocery-specific config.
- Quick filters: Supermarket, Convenience Store, Organic, Kosher, Local Market.
- Green theme.
- Save payload maps `storeType` from Google Places types via a `mapStoreType` utility (similar to `mapCuisineType` in `cuisine-types.ts`).

### GroceryStoresTab
- New dashboard tab in `TripDashboard`.
- Same toggle pattern as restaurants: "My Stores" / "Discover" views.
- Fetches from `/api/trips/{tripId}/grocery-stores` on mount.
- Tab position: after "Restaurants" in the dashboard tab order.
- Tracks `savedPlaceIds` to prevent duplicate saves.

## Non-Goals

- Combined "Search" tab (deferred — each type keeps its own tab).
- Recalculating travel times for saved items when accommodation selection changes.
- Kid-friendly scoring, TripAdvisor ratings, or price level for grocery stores.
