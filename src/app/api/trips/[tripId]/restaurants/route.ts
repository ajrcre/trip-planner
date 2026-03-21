import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateRoute } from "@/lib/google-maps"

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

export async function GET(
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

  const restaurants = await prisma.restaurant.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(restaurants)
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
  const {
    googlePlaceId,
    name,
    cuisineType,
    address,
    lat,
    lng,
    phone,
    website,
    openingHours,
    photos,
    ratingGoogle,
    status,
    kidFriendly,
    types,
  } = body

  // Calculate travel time from accommodation if coordinates are available
  let travelTimeMinutes: number | null = null

  const accommodation = trip.accommodation as {
    coordinates?: { lat: number; lng: number }
  } | null

  if (accommodation?.coordinates && lat && lng) {
    try {
      const route = await calculateRoute(accommodation.coordinates, {
        lat,
        lng,
      })
      travelTimeMinutes = route.durationMinutes
    } catch (error) {
      console.error("Travel time calculation failed:", error)
    }
  }

  // Map cuisine type from Google Places types if not provided directly
  const resolvedCuisineType = cuisineType ?? mapCuisineType(types ?? [])

  const restaurant = await prisma.restaurant.create({
    data: {
      tripId,
      googlePlaceId,
      name,
      cuisineType: resolvedCuisineType,
      address,
      lat,
      lng,
      phone,
      website,
      openingHours,
      photos: photos ?? [],
      ratingGoogle,
      status: status ?? "maybe",
      kidFriendly: kidFriendly ?? false,
      travelTimeMinutes,
      dataSource: "google_places",
      dataLastUpdated: new Date(),
    },
  })

  return NextResponse.json(restaurant, { status: 201 })
}
