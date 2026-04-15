import { NextResponse } from "next/server"
import { requireTripAccess } from "@/lib/trip-access"
import { prisma } from "@/lib/prisma"

// POST — add a member to the trip's family profile. Editor/owner only.
export async function POST(
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
  const { name, dateOfBirth, role: memberRole, specialNeeds } = body

  if (!name || !dateOfBirth || !memberRole) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const member = await prisma.familyMember.create({
    data: {
      familyProfileId: trip.familyProfileId,
      name,
      dateOfBirth: new Date(dateOfBirth),
      role: memberRole,
      specialNeeds: specialNeeds ?? [],
    },
  })

  return NextResponse.json(member, { status: 201 })
}
