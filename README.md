# Trip Planner

A family trip planner built with Next.js. Plan trips with attraction and restaurant discovery, daily schedules, packing lists, and AI-powered suggestions. Hebrew-first interface with RTL support.

## Features

- **Destination Overview** - AI-generated destination info with interactive maps
- **Attractions** - Discover and save attractions with ratings, kid-friendly scores, and travel times
- **Restaurants** - Search by cuisine, filter by ratings, track travel times from accommodation
- **Grocery Stores** - Find supermarkets, convenience stores, and local markets near your accommodation
- **Schedule** - Daily itinerary with timeline view, weather forecasts, and activity management
- **Lists** - Packing and shopping checklists with categories
- **AI Chat Assistant** - Gemini-powered trip planning suggestions
- **Multi-accommodation support** - Search results relative to a selected accommodation
- **Trip sharing** - Share trips via access tokens
- **DOCX export** - Export trip details as Word documents

## Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL (Neon) with Prisma ORM
- **Auth**: NextAuth.js (Google OAuth)
- **AI**: Google Gemini
- **Maps**: Google Maps Platform
- **APIs**: Google Places, TripAdvisor

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Google Cloud project with Maps, Places, and OAuth APIs enabled
- Google Gemini API key

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/ajrcre/trip-planner.git
   cd trip-planner
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` from the example:
   ```bash
   cp .env.example .env
   ```

4. Fill in your environment variables:
   ```
   DATABASE_URL=postgresql://...
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   NEXTAUTH_SECRET=
   NEXTAUTH_URL=http://localhost:3000
   GOOGLE_MAPS_API_KEY=
   GOOGLE_MAPS_CLIENT_KEY=
   NEXT_PUBLIC_GOOGLE_MAPS_CLIENT_KEY=
   TRIPADVISOR_API_KEY=
   GEMINI_API_KEY=
   ```

5. Set up the database:
   ```bash
   npx prisma migrate dev
   ```

6. Start the dev server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── app/              # Next.js pages & API routes
├── components/       # React components (by feature)
│   ├── attractions/  # Attraction card, table, discovery
│   ├── restaurants/  # Restaurant card, table, discovery
│   ├── grocery-stores/ # Grocery store card, table, discovery
│   ├── discovery/    # Generic discovery panel
│   ├── shared/       # Reusable ItemTable, ItemCard
│   ├── schedule/     # Schedule view, activity cards
│   ├── lists/        # Packing & shopping lists
│   └── trips/        # Trip dashboard & tabs
├── hooks/            # useItemActions, useTableFiltering
├── lib/              # Business logic & API integrations
└── types/            # TypeScript definitions
```
