import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
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
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { attractionTypes, foodPreferences, noLayovers, preferredFlightStart, preferredFlightEnd, pace } = body

  const profile = await prisma.familyProfile.upsert({
    where: { userId: session.user.id },
    update: {
      attractionTypes,
      foodPreferences,
      noLayovers,
      preferredFlightStart: preferredFlightStart || null,
      preferredFlightEnd: preferredFlightEnd || null,
      pace,
    },
    create: {
      userId: session.user.id,
      attractionTypes,
      foodPreferences,
      noLayovers,
      preferredFlightStart: preferredFlightStart || null,
      preferredFlightEnd: preferredFlightEnd || null,
      pace,
    },
    include: { members: true },
  })

  return NextResponse.json(profile)
}
