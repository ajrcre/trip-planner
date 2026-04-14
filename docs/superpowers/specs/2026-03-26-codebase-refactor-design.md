# Codebase Refactor: Duplication, Dead Code & Complexity

## Problem

The trip-planner codebase has grown to ~15K lines of hand-written code (excluding generated Prisma). Analysis identified:
- **~966 lines of duplication** across component pairs and API routes
- **~6 dead files/dependencies** (replaced by newer equivalents)
- **~3 over-complex files** (800+ line components, embedded utility logic)

## Approach

Phased refactor (C): three sequential phases, each producing a working codebase with thorough regression testing. Phases should be executed in order (Phase 3 builds on the DiscoveryPanel unification from Phase 1.4).

Existing tests (baseline): `src/lib/__tests__/driving-times.test.ts` and `src/lib/__tests__/normalizers.test.ts` must remain passing throughout all phases.

---

## Phase 1: Dead Code Removal & Shared Utility Extraction

Goal: Remove dead code, extract copy-pasted utilities, unify the two most duplicated component pairs.

### 1.1 Delete dead code

| Item | Path | Reason |
|------|------|--------|
| AiAssistant | `src/components/ai/AiAssistant.tsx` | Replaced by GlobalAiButton + ChatDrawer |
| Places search route | `src/app/api/places/search/route.ts` | Replaced by trip-scoped discover routes |
| Places detail route | `src/app/api/places/[placeId]/route.ts` | Replaced by trip-scoped discover routes |
| AI suggest route | `src/app/api/ai/suggest/route.ts` | Only consumer was unused AiAssistant |
| pdf-lib dependency | `package.json` devDependencies | Never imported anywhere |
| claude.ts | `src/lib/claude.ts` | Already deleted in working tree, confirm removal committed |

### 1.2 Extract `verifyTripAccess` to shared utility

Currently copy-pasted identically (15 lines each) in 12 route files:
- `src/app/api/trips/[tripId]/attractions/route.ts`
- `src/app/api/trips/[tripId]/attractions/[id]/route.ts`
- `src/app/api/trips/[tripId]/attractions/discover/route.ts`
- `src/app/api/trips/[tripId]/restaurants/route.ts`
- `src/app/api/trips/[tripId]/restaurants/[id]/route.ts`
- `src/app/api/trips/[tripId]/restaurants/discover/route.ts`
- `src/app/api/trips/[tripId]/shopping/route.ts`
- `src/app/api/trips/[tripId]/packing/route.ts`
- `src/app/api/trips/[tripId]/schedule/route.ts`
- `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts`
- `src/app/api/trips/[tripId]/weather/route.ts`
- `src/app/api/ai/chat/execute/route.ts`

Create `src/lib/trip-access.ts` exporting `verifyTripAccess(tripId, userId)`. Update all 12 consumers (~180 lines of duplication eliminated).

Additionally, extract the repeated auth + trip-access boilerplate into a `requireTripAccess(tripId)` helper that combines `getAuthSession()` + `verifyTripAccess()` into one call, reducing each route handler by ~10 lines.

### 1.3 Unify PackingList + ShoppingList (90% identical, ~300 duplicated lines)

Create `src/components/lists/ChecklistManager.tsx` — a generic checklist component parameterized by:

```ts
interface ChecklistConfig {
  apiPath: "packing" | "shopping"
  colorScheme: { primary: string; light: string } // e.g. blue-500/blue-50 vs green-500/green-50
  labels: {
    progressLabel: string   // "ארוזים" vs "נקנו"
    emptyState: string
    addPlaceholder: string
  }
}
```

PackingList.tsx and ShoppingList.tsx become thin wrappers (~10 lines each) passing config.

### 1.4 Unify DiscoveryPanel (80% identical, ~150 duplicated lines)

Create `src/components/discovery/DiscoveryPanel.tsx` — a generic discovery component parameterized by:

```ts
interface DiscoveryConfig<T> {
  discoverEndpoint: string          // e.g. `/api/trips/${tripId}/attractions/discover`
  saveEndpoint: string              // e.g. `/api/trips/${tripId}/attractions`
  quickFilters: { label: string; query: string }[]
  CardComponent: React.ComponentType<{ item: T; onSave: () => void }>
  buildSavePayload: (item: T) => Record<string, unknown>
  onItemSaved: () => void
}
```

Both attraction and restaurant DiscoveryPanels become config-driven wrappers.

### 1.5 Extract duplicated `cuisineTypeMap`

The `cuisineTypeMap` constant (~30 lines mapping Google place types to Hebrew labels) is duplicated identically in:
- `src/app/api/trips/[tripId]/restaurants/route.ts`
- `src/app/api/trips/[tripId]/restaurants/discover/route.ts`

Extract to `src/lib/cuisine-types.ts` and import from both consumers.

### Phase 1 testing

| Step | Verification |
|------|-------------|
| Baseline | `npm run build` + `npx jest` — record passing state (existing tests: `driving-times.test.ts`, `normalizers.test.ts`) |
| After 1.1 | `npm run build` + grep confirmation that no `fetch` calls reference `/api/ai/suggest`, `/api/places/search`, or `/api/places/` in any `src/` file |
| After 1.2 | `npm run build` — confirms shared utility wired correctly across all 12 route files |
| After 1.3 | `npm run build` + new unit tests for ChecklistManager data logic (fetch, toggle, delete, add item) |
| After 1.4 | `npm run build` + new unit tests for DiscoveryPanel search/save logic |
| After 1.5 | `npm run build` |

---

## Phase 2: Component Decomposition

Goal: Break apart the largest files into focused, single-responsibility modules.

### 2.1 TripDashboard.tsx (843 lines → ~150 shell + 5 tab files)

Extract to separate files:
- `src/components/trips/tabs/OverviewTab.tsx` (~280 lines)
- `src/components/trips/tabs/AttractionsTab.tsx` (~80 lines)
- `src/components/trips/tabs/RestaurantsTab.tsx` (~80 lines)
- `src/components/trips/tabs/ScheduleTab.tsx` (~60 lines)
- `src/components/trips/tabs/ListsTab.tsx` (~60 lines)
- `src/components/trips/ShareExportButtons.tsx` (~80 lines)

TripDashboard.tsx becomes a thin shell: tab state management + rendering the active tab component.

### 2.2 ActivityCard.tsx (487 lines)

- Extract time-parsing functions to `src/lib/time-parsing.ts` (~65 lines):
  - `parseDayHours()`, `getTodayHours()`, `parseAmPmTo24()`, `parseOpenClose()`, `detectTimeConflict()`
- Extract `OpeningHoursSection` to `src/components/schedule/OpeningHoursSection.tsx`

### 2.3 gemini.ts (598 lines → 3 focused files)

- `src/lib/gemini-extraction.ts` — `extractTripDetails()`
- `src/lib/gemini-chat.ts` — `chatWithFunctions()`, function declarations, `buildChatContext()`
- `src/lib/gemini.ts` — barrel re-export file for backward compatibility (avoids touching every import site)

### Phase 2 testing

| Step | Verification |
|------|-------------|
| After 2.1 | `npm run build` + `npx jest` |
| After 2.2 | `npm run build` + new unit tests for `time-parsing.ts` (pure functions) |
| After 2.3 | `npm run build` + `npx jest` (existing tests still pass) |

---

## Phase 3: Unified Card & Table Components

Goal: Eliminate the remaining duplication between attraction/restaurant UI components.

### 3.1 Unify AttractionCard + RestaurantCard (85% identical)

Extract shared pieces:
- `src/components/shared/RatingStars.tsx` — shared star-rating display
- `src/lib/url-helpers.ts` — `googleMapsUrl(name, address)` helper

Create `src/components/shared/ItemCard.tsx` — generic card with:
- Configurable gradient color, status action buttons, links section
- Render prop / slot for type-specific content (attraction type tags vs cuisine badge)

AttractionCard and RestaurantCard become thin wrappers providing their specific content slot and color.

### 3.2 Unify AttractionTable + RestaurantTable (75% identical)

Extract shared infrastructure:
- `src/lib/status-config.ts` — `statusLabels`, `statusColors` constants
- `src/hooks/useTableFiltering.ts` — shared sort/filter logic hook
- `src/hooks/useItemActions.ts` — shared CRUD handler hook (`handleStatusChange`, `handleDelete`)

Create `src/components/shared/ItemTable.tsx` — generic table driven by column configuration.

AttractionTable and RestaurantTable become config-driven wrappers defining their unique columns and expanded-row content.

### Phase 3 testing

| Step | Verification |
|------|-------------|
| After 3.1 | `npm run build` + unit tests for RatingStars + basic render tests for AttractionCard and RestaurantCard wrappers |
| After 3.2 | `npm run build` + unit tests for `useTableFiltering` and `useItemActions` hooks + basic render tests for AttractionTable and RestaurantTable wrappers |

---

## Summary

| Phase | Lines removed/unified | New files | Risk |
|-------|----------------------|-----------|------|
| 1 | ~550 deleted, ~630 unified | 4 new (trip-access, ChecklistManager, DiscoveryPanel, cuisine-types) | Low |
| 2 | 0 deleted, ~1900 restructured | 9 new (tab files, time-parsing, gemini split) | Medium |
| 3 | ~300 unified | 6 new (shared components, hooks, helpers) | Medium |

Each phase is a separate commit/PR with its own regression testing gate.
