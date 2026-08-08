import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { defaultTodoTemplate } from "@/lib/list-templates"
import { requireTripAccess } from "@/lib/trip-access"

/**
 * Unlike the packing/shopping lists — where a category is just a string column
 * on each item — todo categories are real rows. That lets a category exist with
 * no items and keeps the display order authored rather than alphabetical.
 *
 * The response still flattens `category` down to its name so the shared
 * ChecklistManager can keep grouping items by that string.
 */
async function readList(tripId: string) {
  const categories = await prisma.todoCategory.findMany({
    where: { tripId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  })

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
    })),
    items: categories.flatMap((c) =>
      c.items.map((i) => ({
        id: i.id,
        categoryId: c.id,
        category: c.name,
        item: i.item,
        checked: i.checked,
        sortOrder: i.sortOrder,
      }))
    ),
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  return NextResponse.json(await readList(tripId))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()

  // Initialize from template
  if (body.action === "init-from-template") {
    const existing = await prisma.todoCategory.count({ where: { tripId } })
    if (existing > 0) {
      return NextResponse.json(
        { error: "List already has items" },
        { status: 400 }
      )
    }

    // All-or-nothing: a partial seed would leave categories behind that make
    // the guard above reject every later attempt to seed properly.
    await prisma.$transaction(
      defaultTodoTemplate.map((group, index) =>
        prisma.todoCategory.create({
          data: {
            tripId,
            name: group.category,
            sortOrder: index,
            items: {
              create: group.items.map((item, itemIndex) => ({
                item,
                sortOrder: itemIndex,
              })),
            },
          },
        })
      )
    )

    return NextResponse.json(await readList(tripId), { status: 201 })
  }

  // Add an empty category
  if (body.action === "add-category") {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const duplicate = await prisma.todoCategory.findFirst({
      where: { tripId, name },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: "Category already exists" },
        { status: 409 }
      )
    }

    const maxSort = await prisma.todoCategory.findFirst({
      where: { tripId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    })

    const category = await prisma.todoCategory.create({
      data: { tripId, name, sortOrder: (maxSort?.sortOrder ?? -1) + 1 },
    })

    return NextResponse.json(
      { id: category.id, name: category.name, sortOrder: category.sortOrder },
      { status: 201 }
    )
  }

  // Add single item
  const { categoryId, item } = body

  if (!categoryId || !item) {
    return NextResponse.json(
      { error: "categoryId and item are required" },
      { status: 400 }
    )
  }

  const category = await prisma.todoCategory.findFirst({
    where: { id: categoryId, tripId },
  })

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }

  const maxSort = await prisma.todoItem.findFirst({
    where: { categoryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })

  const newItem = await prisma.todoItem.create({
    data: {
      categoryId,
      item,
      sortOrder: (maxSort?.sortOrder ?? -1) + 1,
    },
  })

  return NextResponse.json(
    { ...newItem, category: category.name },
    { status: 201 }
  )
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const itemId = url.searchParams.get("itemId")

  if (!itemId) {
    return NextResponse.json(
      { error: "itemId query param required" },
      { status: 400 }
    )
  }

  const existing = await prisma.todoItem.findFirst({
    where: { id: itemId, category: { tripId } },
    include: { category: true },
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

  const updated = await prisma.todoItem.update({
    where: { id: itemId },
    data: updateData,
  })

  return NextResponse.json({ ...updated, category: existing.category.name })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const itemId = url.searchParams.get("itemId")
  const categoryId = url.searchParams.get("categoryId")

  // Delete a whole category (its items cascade)
  if (categoryId) {
    const category = await prisma.todoCategory.findFirst({
      where: { id: categoryId, tripId },
    })

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    await prisma.todoCategory.delete({ where: { id: categoryId } })

    return NextResponse.json({ success: true })
  }

  if (!itemId) {
    return NextResponse.json(
      { error: "itemId or categoryId query param required" },
      { status: 400 }
    )
  }

  const existing = await prisma.todoItem.findFirst({
    where: { id: itemId, category: { tripId } },
  })

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 })
  }

  await prisma.todoItem.delete({ where: { id: itemId } })

  return NextResponse.json({ success: true })
}
