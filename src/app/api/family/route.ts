import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let profile = await prisma.familyProfile.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  })

  if (!profile) {
    profile = await prisma.familyProfile.create({
      data: { userId: session.user.id },
      include: { members: true },
    })
  }

  return NextResponse.json(profile)
}

export async function PUT(request: Request) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { attractionTypes, foodPreferences, noLayovers, preferredFlightStart, preferredFlightEnd, pace, preFlightArrivalMinutes, carPickupDurationMinutes, carReturnDurationMinutes } = body

  // Validate logistics duration fields
  if (preFlightArrivalMinutes !== undefined && (typeof preFlightArrivalMinutes !== "number" || preFlightArrivalMinutes < 30 || preFlightArrivalMinutes > 360)) {
    return NextResponse.json({ error: "preFlightArrivalMinutes must be 30-360" }, { status: 400 })
  }
  if (carPickupDurationMinutes !== undefined && (typeof carPickupDurationMinutes !== "number" || carPickupDurationMinutes < 15 || carPickupDurationMinutes > 240)) {
    return NextResponse.json({ error: "carPickupDurationMinutes must be 15-240" }, { status: 400 })
  }
  if (carReturnDurationMinutes !== undefined && (typeof carReturnDurationMinutes !== "number" || carReturnDurationMinutes < 15 || carReturnDurationMinutes > 180)) {
    return NextResponse.json({ error: "carReturnDurationMinutes must be 15-180" }, { status: 400 })
  }

  const profile = await prisma.familyProfile.upsert({
    where: { userId: session.user.id },
    update: {
      attractionTypes,
      foodPreferences,
      noLayovers,
      preferredFlightStart: preferredFlightStart || null,
      preferredFlightEnd: preferredFlightEnd || null,
      pace,
      ...(preFlightArrivalMinutes !== undefined && { preFlightArrivalMinutes }),
      ...(carPickupDurationMinutes !== undefined && { carPickupDurationMinutes }),
      ...(carReturnDurationMinutes !== undefined && { carReturnDurationMinutes }),
    },
    create: {
      userId: session.user.id,
      attractionTypes,
      foodPreferences,
      noLayovers,
      preferredFlightStart: preferredFlightStart || null,
      preferredFlightEnd: preferredFlightEnd || null,
      pace,
      ...(preFlightArrivalMinutes !== undefined && { preFlightArrivalMinutes }),
      ...(carPickupDurationMinutes !== undefined && { carPickupDurationMinutes }),
      ...(carReturnDurationMinutes !== undefined && { carReturnDurationMinutes }),
    },
    include: { members: true },
  })

  return NextResponse.json(profile)
}
