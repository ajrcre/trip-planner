import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateTripDocx } from "@/lib/export-docx"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tripId } = await params

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      shares: true,
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

  // Verify access: owner or shared
  const isOwner = trip.userId === session.user.id
  const isShared = trip.shares.some((s) => s.userId === session.user.id)
  if (!isOwner && !isShared) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const buffer = await generateTripDocx({
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate.toISOString(),
    endDate: trip.endDate.toISOString(),
    accommodation: trip.accommodation as TripAccommodation[] | null,
    flights: trip.flights as TripFlights | null,
    carRental: trip.carRental as TripCarRental | null,
    attractions: trip.attractions,
    restaurants: trip.restaurants,
    dayPlans: trip.dayPlans.map((dp) => ({
      ...dp,
      date: dp.date.toISOString(),
    })),
    packingItems: trip.packingItems,
    shoppingItems: trip.shoppingItems,
  })

  const filename = encodeURIComponent(`${trip.name}.docx`)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  })
}

// Type helpers for JSON fields
type TripAccommodation = {
  name?: string
  address?: string
  checkIn?: string
  checkOut?: string
  contact?: string
  bookingReference?: string
}

type TripFlights = {
  outbound?: {
    flightNumber?: string
    departureAirport?: string
    departureTime?: string
    arrivalAirport?: string
    arrivalTime?: string
  }
  return?: {
    flightNumber?: string
    departureAirport?: string
    departureTime?: string
    arrivalAirport?: string
    arrivalTime?: string
  }
}

type TripCarRental = {
  company?: string
  pickupLocation?: string
  returnLocation?: string
  additionalDetails?: string
}
