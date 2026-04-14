import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { defaultPackingTemplate } from "@/lib/list-templates"
import { requireTripAccess } from "@/lib/trip-access"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const items = await prisma.packingItem.findMany({
    where: { tripId },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  })

  // Group by category
  const grouped: Record<string, typeof items> = {}
  for (const item of items) {
    if (!grouped[item.category]) {
      grouped[item.category] = []
    }
    grouped[item.category].push(item)
  }

  return NextResponse.json({ items, grouped })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const body = await request.json()

  // Initialize from template
  if (body.action === "init-from-template") {
    const existing = await prisma.packingItem.count({ where: { tripId } })
    if (existing > 0) {
      return NextResponse.json(
        { error: "List already has items" },
        { status: 400 }
      )
    }

    const data: {
      tripId: string
      category: string
      item: string
      sortOrder: number
    }[] = []

    for (const group of defaultPackingTemplate) {
      group.items.forEach((item, index) => {
        data.push({
          tripId,
          category: group.category,
          item,
          sortOrder: index,
        })
      })
    }

    await prisma.packingItem.createMany({ data })

    const items = await prisma.packingItem.findMany({
      where: { tripId },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    })

    return NextResponse.json({ items }, { status: 201 })
  }

  // Add single item
  const { category, item, forMember } = body

  if (!category || !item) {
    return NextResponse.json(
      { error: "category and item are required" },
      { status: 400 }
    )
  }

  const maxSort = await prisma.packingItem.findFirst({
    where: { tripId, category },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })

  const newItem = await prisma.packingItem.create({
    data: {
      tripId,
      category,
      item,
      forMember: forMember || null,
      sortOrder: (maxSort?.sortOrder ?? -1) + 1,
    },
  })

  return NextResponse.json(newItem, { status: 201 })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const url = new URL(request.url)
  const itemId = url.searchParams.get("itemId")

  if (!itemId) {
    return NextResponse.json(
      { error: "itemId query param required" },
      { status: 400 }
    )
  }

  const existing = await prisma.packingItem.findFirst({
    where: { id: itemId, tripId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 })
  }

  const body = await request.json()
  const updateData: { checked?: boolean; item?: string } = {}

  if (typeof body.checked === "boolean") {
    updateData.checked = body.checked
  }
  if (typeof body.item === "string") {
    updateData.item = body.item
  }

  const updated = await prisma.packingItem.update({
    where: { id: itemId },
    data: updateData,
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const url = new URL(request.url)
  const itemId = url.searchParams.get("itemId")

  if (!itemId) {
    return NextResponse.json(
      { error: "itemId query param required" },
      { status: 400 }
    )
  }

  const existing = await prisma.packingItem.findFirst({
    where: { id: itemId, tripId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 })
  }

  await prisma.packingItem.delete({ where: { id: itemId } })

  return NextResponse.json({ success: true })
}
