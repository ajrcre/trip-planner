import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { requireTripAccess } from "@/lib/trip-access"
import { translateShoppingItems } from "@/lib/gemini"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result

  const { trip } = result

  const countryCode = (trip.destinationInfo as Record<string, unknown> | null)
    ?.countryCode as string | undefined

  if (!countryCode) {
    return NextResponse.json(
      { error: "Trip has no destination info with country code" },
      { status: 400 }
    )
  }

  const items = await prisma.shoppingItem.findMany({
    where: {
      tripId,
      OR: [
        { localName: null },
        { localLanguage: { not: countryCode } },
      ],
    },
    select: { id: true, item: true },
  })

  if (items.length === 0) {
    const allItems = await prisma.shoppingItem.findMany({
      where: { tripId },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    })
    return NextResponse.json({ items: allItems })
  }

  try {
    const translations = await translateShoppingItems(items, countryCode)
    const translationMap = new Map(translations.map((t) => [t.id, t]))

    await prisma.$transaction(
      items.map((item) => {
        const translation = translationMap.get(item.id)
        return prisma.shoppingItem.update({
          where: { id: item.id },
          data: {
            localName: translation?.localName ?? null,
            transliteration: translation?.transliteration ?? null,
            localLanguage: countryCode,
          },
        })
      })
    )
  } catch (err) {
    console.error("Translation failed:", err)
    return NextResponse.json(
      { error: "Failed to translate shopping items" },
      { status: 502 }
    )
  }

  const allItems = await prisma.shoppingItem.findMany({
    where: { tripId },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  })

  return NextResponse.json({ items: allItems })
}
