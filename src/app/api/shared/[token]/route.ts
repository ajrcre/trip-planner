import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const trip = await prisma.trip.findUnique({
    where: { shareToken: token },
    include: {
      attractions: {
        where: { status: { not: "rejected" } },
        orderBy: { name: "asc" },
      },
      restaurants: {
        where: { status: { not: "rejected" } },
        orderBy: { name: "asc" },
      },
      dayPlans: {
        include: {
          activities: {
            include: {
              attraction: true,
              restaurant: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { date: "asc" },
      },
      packingItems: {
        orderBy: { sortOrder: "asc" },
      },
      shoppingItems: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Strip sensitive fields - don't expose userId or internal IDs
  const { userId: _userId, shareToken: _shareToken, ...safeTrip } = trip

  return NextResponse.json(safeTrip)
}
