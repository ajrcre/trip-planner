import { NextResponse } from "next/server"

import { geocodeAddress } from "@/lib/google-maps"
import { getWeatherForecast } from "@/lib/weather"
import { requireTripAccess } from "@/lib/trip-access"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { trip } = result

  if (!trip.destination) {
    return NextResponse.json(
      { error: "Trip has no destination" },
      { status: 422 }
    )
  }

  const coords = await geocodeAddress(trip.destination)
  if (!coords) {
    return NextResponse.json(
      { error: "Could not geocode destination" },
      { status: 422 }
    )
  }

  // Clamp date range to Open-Meteo's 16-day forecast window
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxForecastDate = new Date(today)
  maxForecastDate.setDate(maxForecastDate.getDate() + 15)

  const tripStart = new Date(trip.startDate)
  const tripEnd = new Date(trip.endDate)

  // If trip is entirely in the future beyond forecast range, return empty
  if (tripStart > maxForecastDate) {
    return NextResponse.json({
      daily: [],
      hourly: [],
      timezone: "auto",
      forecastAvailableUntil: maxForecastDate.toISOString().split("T")[0],
      coordinates: coords,
    })
  }

  const startDate = tripStart < today
    ? today.toISOString().split("T")[0]
    : tripStart.toISOString().split("T")[0]
  const endDate = tripEnd > maxForecastDate
    ? maxForecastDate.toISOString().split("T")[0]
    : tripEnd.toISOString().split("T")[0]

  try {
    const forecast = await getWeatherForecast(
      coords.lat,
      coords.lng,
      startDate,
      endDate
    )

    return NextResponse.json({
      ...forecast,
      coordinates: coords,
    })
  } catch {
    return NextResponse.json(
      { error: "Weather service unavailable" },
      { status: 502 }
    )
  }
}
