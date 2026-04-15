import { NextResponse } from "next/server"
import { requireTripAccess } from "@/lib/trip-access"
import { prisma } from "@/lib/prisma"

// Verify the member belongs to this trip's family profile
async function resolveMember(tripFamilyProfileId: string, memberId: string) {
  const member = await prisma.familyMember.findUnique({
    where: { id: memberId },
  })
  if (!member || member.familyProfileId !== tripFamilyProfileId) return null
  return member
}

// PUT — update a member. Editor/owner only.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ tripId: string; memberId: string }> }
) {
  const { tripId, memberId } = await params
  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip, role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!trip.familyProfileId) {
    return NextResponse.json({ error: "No profile" }, { status: 404 })
  }

  const member = await resolveMember(trip.familyProfileId, memberId)
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  const body = await req.json()
  const { name, dateOfBirth, role: memberRole, specialNeeds } = body

  const updated = await prisma.familyMember.update({
    where: { id: memberId },
    data: {
      name,
      dateOfBirth: new Date(dateOfBirth),
      role: memberRole,
      specialNeeds: specialNeeds ?? [],
    },
  })

  return NextResponse.json(updated)
}

// DELETE — remove a member. Editor/owner only.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tripId: string; memberId: string }> }
) {
  const { tripId, memberId } = await params
  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip, role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!trip.familyProfileId) {
    return NextResponse.json({ error: "No profile" }, { status: 404 })
  }

  const member = await resolveMember(trip.familyProfileId, memberId)
  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 })
  }

  await prisma.familyMember.delete({ where: { id: memberId } })

  return NextResponse.json({ ok: true })
}
