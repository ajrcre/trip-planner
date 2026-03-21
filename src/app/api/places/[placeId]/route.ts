import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getPlaceDetails } from "@/lib/google-maps"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ placeId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { placeId } = await params

  if (!placeId) {
    return NextResponse.json(
      { error: "Missing placeId" },
      { status: 400 }
    )
  }

  try {
    const details = await getPlaceDetails(placeId)
    return NextResponse.json(details)
  } catch (error) {
    console.error("Place details error:", error)
    return NextResponse.json(
      { error: "Failed to get place details" },
      { status: 500 }
    )
  }
}
