import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { suggestActivities } from "@/lib/claude"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { tripId, question } = body

  if (!tripId || !question) {
    return NextResponse.json(
      { error: "tripId and question are required" },
      { status: 400 }
    )
  }

  // Fetch trip with related data
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      shares: true,
      attractions: true,
      restaurants: true,
      dayPlans: {
        include: { activities: { include: { attraction: true, restaurant: true } } },
        orderBy: { date: "asc" },
      },
    },
  })

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 })
  }

  // Verify access
  const isOwner = trip.userId === session.user.id
  const isShared = trip.shares.some((s) => s.userId === session.user.id)
  if (!isOwner && !isShared) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Fetch family members
  const familyProfile = await prisma.familyProfile.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  })

  // Build context
  const now = new Date()
  const familyMembers = familyProfile?.members.map((m) => ({
    name: m.name,
    age: Math.floor(
      (now.getTime() - m.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    ),
    role: m.role,
  }))

  const savedAttractions = trip.attractions.map((a) => ({
    name: a.name,
    status: a.status,
    travelTimeMinutes: a.travelTimeMinutes ?? undefined,
  }))

  const savedRestaurants = trip.restaurants.map((r) => ({
    name: r.name,
    cuisineType: r.cuisineType ?? undefined,
  }))

  const currentSchedule = trip.dayPlans.map((dp) => ({
    date: dp.date.toISOString().split("T")[0],
    activities: dp.activities.map((a) => {
      if (a.attraction) return a.attraction.name
      if (a.restaurant) return a.restaurant.name
      return a.type
    }),
  }))

  try {
    const answer = await suggestActivities({
      destination: trip.destination,
      tripDates: {
        start: trip.startDate.toISOString().split("T")[0],
        end: trip.endDate.toISOString().split("T")[0],
      },
      familyMembers,
      savedAttractions,
      savedRestaurants,
      currentSchedule,
      userQuestion: question,
    })

    return NextResponse.json({ answer })
  } catch (error) {
    console.error("AI suggestion error:", error)
    return NextResponse.json(
      { error: "Failed to get AI suggestion" },
      { status: 500 }
    )
  }
}
