import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not configured")
  return key
}

interface WaypointInput {
  lat: number
  lng: number
}

function toRouteWaypoint(point: WaypointInput) {
  return {
    location: {
      latLng: {
        latitude: point.lat,
        longitude: point.lng,
      },
    },
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const waypoints: WaypointInput[] = body.waypoints

  if (!waypoints || waypoints.length < 2) {
    return NextResponse.json({ error: "At least 2 waypoints required" }, { status: 400 })
  }

  const origin = toRouteWaypoint(waypoints[0])
  const destination = toRouteWaypoint(waypoints[waypoints.length - 1])
  const intermediates = waypoints.slice(1, -1).map(toRouteWaypoint)

  try {
    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": getApiKey(),
          "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin,
          destination,
          ...(intermediates.length > 0 ? { intermediates } : {}),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: `Routes API error: ${error}` }, { status: 502 })
    }

    const data = await response.json()
    const encodedPolyline = data.routes?.[0]?.polyline?.encodedPolyline

    if (!encodedPolyline) {
      return NextResponse.json({ error: "No route found" }, { status: 404 })
    }

    return NextResponse.json({ encodedPolyline })
  } catch (error) {
    console.error("Route polyline error:", error)
    return NextResponse.json({ error: "Failed to compute route" }, { status: 500 })
  }
}
