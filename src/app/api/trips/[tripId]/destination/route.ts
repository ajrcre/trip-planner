import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateDestinationInfo, translateShoppingItems } from "@/lib/gemini"
import { geocodeAddress } from "@/lib/google-maps"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { shares: true },
  })
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  const isOwner = trip.userId === session.user.id
  const isShared = trip.shares.some((s) => s.userId === session.user.id)
  if (!isOwner && !isShared) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!trip.destination) {
    return NextResponse.json(
      { error: "Trip has no destination set" },
      { status: 422 }
    )
  }

  try {
    const info = await generateDestinationInfo(trip.destination)

    // Add geocoded coordinates
    const coords = await geocodeAddress(trip.destination)
    if (coords) {
      info.coordinates = coords
    }

    // Save to database
    await prisma.trip.update({
      where: { id: tripId },
      data: { destinationInfo: info as any },
    })

    // Auto-translate shopping items if any exist
    if (info.countryCode) {
      try {
        const untranslated = await prisma.shoppingItem.findMany({
          where: {
            tripId,
            OR: [
              { localName: null },
              { localLanguage: { not: info.countryCode } },
            ],
          },
          select: { id: true, item: true },
        })
        if (untranslated.length > 0) {
          const translations = await translateShoppingItems(untranslated, info.countryCode)
          const translationMap = new Map(translations.map((t) => [t.id, t]))
          await prisma.$transaction(
            untranslated.map((item) => {
              const translation = translationMap.get(item.id)
              return prisma.shoppingItem.update({
                where: { id: item.id },
                data: {
                  localName: translation?.localName ?? null,
                  transliteration: translation?.transliteration ?? null,
                  localLanguage: info.countryCode,
                },
              })
            })
          )
        }
      } catch (err) {
        console.error("Auto-translate shopping items after destination generation failed:", err)
      }
    }

    return NextResponse.json(info)
  } catch (error) {
    console.error("Failed to generate destination info:", error)
    return NextResponse.json(
      { error: "Failed to generate destination info" },
      { status: 502 }
    )
  }
}
