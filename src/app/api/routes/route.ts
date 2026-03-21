import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { calculateRoute } from "@/lib/google-maps"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { origin, destination } = body

  if (origin?.lat == null || origin?.lng == null || destination?.lat == null || destination?.lng == null) {
    return NextResponse.json(
      { error: "Missing required fields: origin.lat, origin.lng, destination.lat, destination.lng" },
      { status: 400 }
    )
  }

  try {
    const result = await calculateRoute(origin, destination)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Route calculation error:", error)
    return NextResponse.json(
      { error: "Failed to calculate route" },
      { status: 500 }
    )
  }
}
