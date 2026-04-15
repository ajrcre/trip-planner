import { NextResponse } from "next/server"
import { requireTripAccess } from "@/lib/trip-access"
import { prisma } from "@/lib/prisma"

// GET — return trip's FamilyProfile (null if not set)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { familyProfile: { include: { members: true } } },
  })

  return NextResponse.json(trip?.familyProfile ?? null)
}

// POST — create trip profile (optionally seeded from caller's default)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { session, trip, role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (trip.familyProfileId) {
    return NextResponse.json({ error: "Profile already exists" }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const { seedFromDefault } = body as { seedFromDefault?: boolean }

  let profileData: Record<string, unknown> = {}

  if (seedFromDefault) {
    const defaultProfile = await prisma.familyProfile.findUnique({
      where: { userId: session.user.id },
      include: { members: true },
    })
    if (defaultProfile) {
      profileData = {
        attractionTypes: defaultProfile.attractionTypes,
        foodPreferences: defaultProfile.foodPreferences,
        noLayovers: defaultProfile.noLayovers,
        preferredFlightStart: defaultProfile.preferredFlightStart,
        preferredFlightEnd: defaultProfile.preferredFlightEnd,
        pace: defaultProfile.pace,
        preFlightArrivalMinutes: defaultProfile.preFlightArrivalMinutes,
        carPickupDurationMinutes: defaultProfile.carPickupDurationMinutes,
        carReturnDurationMinutes: defaultProfile.carReturnDurationMinutes,
        members: {
          create: defaultProfile.members.map((m) => ({
            name: m.name,
            dateOfBirth: m.dateOfBirth,
            role: m.role,
            specialNeeds: m.specialNeeds,
          })),
        },
      }
    }
  }

  const profile = await prisma.familyProfile.create({
    data: profileData,
    include: { members: true },
  })

  await prisma.trip.update({
    where: { id: tripId },
    data: { familyProfileId: profile.id },
  })

  return NextResponse.json(profile, { status: 201 })
}

// PUT — update trip profile preferences
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params
  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip, role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!trip.familyProfileId) {
    return NextResponse.json({ error: "No profile" }, { status: 404 })
  }

  const body = await req.json()
  const {
    attractionTypes,
    foodPreferences,
    noLayovers,
    preferredFlightStart,
    preferredFlightEnd,
    pace,
    preFlightArrivalMinutes,
    carPickupDurationMinutes,
    carReturnDurationMinutes,
  } = body

  const profile = await prisma.familyProfile.update({
    where: { id: trip.familyProfileId },
    data: {
      ...(attractionTypes !== undefined && { attractionTypes }),
      ...(foodPreferences !== undefined && { foodPreferences }),
      ...(noLayovers !== undefined && { noLayovers }),
      ...(preferredFlightStart !== undefined && { preferredFlightStart }),
      ...(preferredFlightEnd !== undefined && { preferredFlightEnd }),
      ...(pace !== undefined && { pace }),
      ...(preFlightArrivalMinutes !== undefined && { preFlightArrivalMinutes }),
      ...(carPickupDurationMinutes !== undefined && { carPickupDurationMinutes }),
      ...(carReturnDurationMinutes !== undefined && { carReturnDurationMinutes }),
    },
    include: { members: true },
  })

  return NextResponse.json(profile)
}
