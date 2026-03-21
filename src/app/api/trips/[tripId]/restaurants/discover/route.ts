import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { searchPlaces } from "@/lib/google-maps"

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

const cuisineTypeMap: Record<string, string> = {
  italian_restaurant: "איטלקי",
  greek_restaurant: "יווני",
  japanese_restaurant: "יפני",
  chinese_restaurant: "סיני",
  thai_restaurant: "תאילנדי",
  indian_restaurant: "הודי",
  mexican_restaurant: "מקסיקני",
  french_restaurant: "צרפתי",
  turkish_restaurant: "טורקי",
  korean_restaurant: "קוריאני",
  vietnamese_restaurant: "וייטנאמי",
  spanish_restaurant: "ספרדי",
  american_restaurant: "אמריקאי",
  mediterranean_restaurant: "ים תיכוני",
  middle_eastern_restaurant: "מזרח תיכוני",
  seafood_restaurant: "דגים/פירות ים",
  steak_house: "בשרים",
  pizza_restaurant: "פיצה",
  sushi_restaurant: "סושי",
  hamburger_restaurant: "המבורגר",
  ice_cream_shop: "גלידה",
  bakery: "מאפייה",
  cafe: "בית קפה",
  coffee_shop: "בית קפה",
  bar: "בר",
  fast_food_restaurant: "מזון מהיר",
  restaurant: "מסעדה",
}

function mapCuisineType(types: string[]): string | null {
  for (const type of types) {
    if (cuisineTypeMap[type]) return cuisineTypeMap[type]
  }
  return null
}

export async function POST(
  request: Request,
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

  const body = await request.json()
  const { query, types, radius } = body as {
    query?: string
    types?: string[]
    radius?: number
  }

  // Get accommodation coordinates for location bias
  const accommodation = trip.accommodation as {
    coordinates?: { lat: number; lng: number }
  } | null

  const location = accommodation?.coordinates ?? { lat: 0, lng: 0 }
  const searchRadius = radius ?? 50000

  // Build search query
  const searchQuery = query || `restaurants ${trip.destination}`
  const typeString = types?.length ? types.join(" ") : undefined

  try {
    const results = await searchPlaces(
      searchQuery,
      location,
      searchRadius,
      typeString
    )

    // Return basic results (max 20)
    const enriched = results.slice(0, 20).map((place) => ({
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
      cuisineType: mapCuisineType(place.types ?? []),
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error("Restaurant discovery search failed:", error)
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    )
  }
}
