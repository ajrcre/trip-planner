import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const trips = await prisma.trip.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      destination: true,
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "desc" },
  })

  return NextResponse.json(trips)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, destination, startDate, endDate, accommodation, flights, carRental } = body

  if (!name || !destination || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    )
  }

  const trip = await prisma.trip.create({
    data: {
      userId: session.user.id,
      name,
      destination,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      accommodation: accommodation || undefined,
      flights: flights || undefined,
      carRental: carRental || undefined,
    },
  })

  return NextResponse.json(trip, { status: 201 })
}
