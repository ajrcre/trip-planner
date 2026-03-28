import { NextResponse } from "next/server"

import { requireTripAccess } from "@/lib/trip-access"
import prisma from "@/lib/prisma"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tripId: string; id: string }> }
) {
  const { tripId, id } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const existing = await prisma.groceryStore.findFirst({
    where: { id, tripId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json()
  const { status, storeType } = body

  const updateData: Record<string, unknown> = {}
  if (status !== undefined) updateData.status = status
  if (storeType !== undefined) updateData.storeType = storeType

  const updated = await prisma.groceryStore.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string; id: string }> }
) {
  const { tripId, id } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const existing = await prisma.groceryStore.findFirst({
    where: { id, tripId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.groceryStore.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
