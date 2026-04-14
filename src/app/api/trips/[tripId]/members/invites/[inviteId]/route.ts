import { NextResponse } from "next/server"
import { requireTripAccess } from "@/lib/trip-access"
import { prisma } from "@/lib/prisma"

// DELETE — cancel pending invite. Owner only.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tripId: string; inviteId: string }> }
) {
  const { tripId, inviteId } = await params
  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.tripInvite.delete({ where: { id: inviteId } })

  return NextResponse.json({ ok: true })
}
