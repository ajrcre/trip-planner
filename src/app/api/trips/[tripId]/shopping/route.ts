import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { defaultShoppingTemplate } from "@/lib/list-templates"
import { requireTripAccess } from "@/lib/trip-access"
import { translateShoppingItems } from "@/lib/gemini"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const items = await prisma.shoppingItem.findMany({
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
    const existing = await prisma.shoppingItem.count({ where: { tripId } })
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

    for (const group of defaultShoppingTemplate) {
      group.items.forEach((item, index) => {
        data.push({
          tripId,
          category: group.category,
          item,
          sortOrder: index,
        })
      })
    }

    await prisma.shoppingItem.createMany({ data })

    const items = await prisma.shoppingItem.findMany({
      where: { tripId },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    })

    return NextResponse.json({ items }, { status: 201 })
  }

  // Add single item
  const { category, item } = body

  if (!category || !item) {
    return NextResponse.json(
      { error: "category and item are required" },
      { status: 400 }
    )
  }

  const maxSort = await prisma.shoppingItem.findFirst({
    where: { tripId, category },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })

  const newItem = await prisma.shoppingItem.create({
    data: {
      tripId,
      category,
      item,
      sortOrder: (maxSort?.sortOrder ?? -1) + 1,
    },
  })

  // Fire-and-forget: translate in the background so the UI isn't blocked
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { destinationInfo: true },
  })
  const countryCode = (trip?.destinationInfo as Record<string, unknown>)
    ?.countryCode as string | undefined

  if (countryCode) {
    translateShoppingItems(
      [{ id: newItem.id, item: newItem.item }],
      countryCode
    )
      .then(async (translations) => {
        if (translations[0]) {
          await prisma.shoppingItem.update({
            where: { id: newItem.id },
            data: {
              localName: translations[0].localName,
              transliteration: translations[0].transliteration,
              localLanguage: countryCode,
            },
          })
        }
      })
      .catch((err) => {
        console.error("Background translate failed for new shopping item:", err)
      })
  }

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

  const existing = await prisma.shoppingItem.findFirst({
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

  const updated = await prisma.shoppingItem.update({
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

  const existing = await prisma.shoppingItem.findFirst({
    where: { id: itemId, tripId },
  })

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 })
  }

  await prisma.shoppingItem.delete({ where: { id: itemId } })

  return NextResponse.json({ success: true })
}
