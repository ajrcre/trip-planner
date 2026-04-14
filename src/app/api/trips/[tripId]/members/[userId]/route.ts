import { NextResponse } from "next/server"
import { requireTripAccess } from "@/lib/trip-access"
import { prisma } from "@/lib/prisma"

// PUT — change role. Owner only.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ tripId: string; userId: string }> }
) {
  const { tripId, userId } = await params
  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { newRole } = body as { newRole: string }

  if (!["editor", "viewer"].includes(newRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const share = await prisma.tripShare.update({
    where: { tripId_userId: { tripId, userId } },
    data: { role: newRole },
  })

  return NextResponse.json({ role: share.role })
}

// DELETE — remove member (owner removes others; any non-owner can remove themselves = leave).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tripId: string; userId: string }> }
) {
  const { tripId, userId } = await params
  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { session, role } = result

  const isSelf = session.user.id === userId
  if (!isSelf && role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.tripShare.delete({
    where: { tripId_userId: { tripId, userId } },
  })

  return NextResponse.json({ ok: true })
}
