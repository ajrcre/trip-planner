import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { searchPlaces } from "@/lib/google-maps"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { query, lat, lng, radius, type } = body

  if (!query || lat == null || lng == null || !radius) {
    return NextResponse.json(
      { error: "Missing required fields: query, lat, lng, radius" },
      { status: 400 }
    )
  }

  try {
    const results = await searchPlaces(query, { lat, lng }, radius, type)
    return NextResponse.json(results)
  } catch (error) {
    console.error("Places search error:", error)
    return NextResponse.json(
      { error: "Failed to search places" },
      { status: 500 }
    )
  }
}
