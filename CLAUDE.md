# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack (port 3000)
npm run build            # Production build
npm run lint             # ESLint

# Database
npx prisma generate      # Regenerate Prisma client (output: src/generated/prisma)
npx prisma migrate dev   # Run migrations in development
npx prisma db push       # Push schema changes without migration

# Tests
npx jest                         # Run all tests
npx jest --testPathPattern=driving-times  # Run a specific test file
```

## Architecture

**Stack**: Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict), Tailwind CSS 4, Prisma 7 + PostgreSQL (Neon serverless), NextAuth.js 4 (Google OAuth), Google Gemini AI, Google Maps Platform.

**Language/UI**: Hebrew-first with RTL layout. Gemini system prompts are in Hebrew.

### Key Patterns

- **Auth**: `getAuthSession()` from `src/lib/auth.ts` in every API route. Dev mode: `BYPASS_AUTH=true` skips Google login and uses first DB user.
- **Trip access control**: `requireTripAccess(tripId)` from `src/lib/trip-access.ts` validates ownership or shared access on every trip endpoint.
- **Prisma client**: Singleton with PrismaPg adapter in `src/lib/prisma.ts`. Import from `@/generated/prisma` for types.
- **AI function calling**: Gemini proposes structured `ActionProposal` objects → user approves in UI → `POST /api/ai/chat/execute` runs them. Types in `src/types/ai-chat.ts`.
- **Item status model**: Attractions, restaurants, grocery stores use `status` field (want/maybe/rejected) for filtering/sorting.
- **JSON fields on Trip**: `accommodation`, `flights`, `carRental`, `destinationInfo` are stored as JSON columns.
- **Path alias**: `@/*` maps to `./src/*`.

### Code Organization

- `src/app/api/` — REST API routes following Next.js App Router conventions
- `src/components/trips/TripDashboard.tsx` — Main trip view with tabbed interface (Overview, Destination, Attractions, Restaurants, Grocery Stores, Schedule, Lists)
- `src/components/trips/tabs/` — Tab content components
- `src/components/shared/` — Reusable `ItemTable`, `ItemCard` used across attractions/restaurants/grocery stores
- `src/hooks/useItemActions.ts` — Generic CRUD hook for items (status change, delete, field update)
- `src/hooks/useTableFiltering.ts` — Filter by status + sort with custom comparators
- `src/lib/gemini-chat.ts` — Gemini chat with function calling schemas (add/remove/replace activities, plan full trip)
- `src/lib/gemini-extraction.ts` — Extract trip details from uploaded files via Gemini
- `src/lib/google-maps.ts` — Geocoding, Places API v2, Routes API
- `src/lib/driving-times.ts` — Travel time computation with caching

### API Route Pattern

All trip sub-resource routes follow this structure:
```
GET    /api/trips/[tripId]/<resource>        → list
POST   /api/trips/[tripId]/<resource>        → create
PUT    /api/trips/[tripId]/<resource>/[id]   → update
DELETE /api/trips/[tripId]/<resource>/[id]   → delete
```

Discovery endpoints: `GET /api/trips/[tripId]/<resource>/discover?q=...` search Google Maps + TripAdvisor.

### Testing

Jest with ts-jest. Tests live in `src/lib/__tests__/`. Mock external APIs (e.g., `jest.mock("../google-maps")`).

### Environment Variables

See `.env.example`. Required: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_CLIENT_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_CLIENT_KEY`, `TRIPADVISOR_API_KEY`, `GEMINI_API_KEY`.
