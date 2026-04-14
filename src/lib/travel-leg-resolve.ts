import type { Accommodation } from "@/lib/accommodations"
import type { CarRental, FlightLeg } from "@/lib/normalizers"
import { geocodeAddress, calculateRoute } from "@/lib/google-maps"
import type { TravelEndpointRef, TravelLegStored } from "@/types/travel-leg"

export interface ResolvedPoint {
  lat: number
  lng: number
  label: string
}

type PlaceRow = { id: string; name: string; lat: number | null; lng: number | null }

export type PlaceMaps = {
  attractions: Map<string, PlaceRow>
  restaurants: Map<string, PlaceRow>
  groceryStores: Map<string, PlaceRow>
}

export async function resolveTravelEndpoint(
  ref: TravelEndpointRef,
  places: PlaceMaps,
  accommodations: Accommodation[],
  flights: FlightLeg[],
  carRentals: CarRental[]
): Promise<ResolvedPoint | null> {
  switch (ref.kind) {
    case "attraction": {
      const p = places.attractions.get(ref.id)
      if (!p) return null
      if (p.lat != null && p.lng != null) {
        return { lat: p.lat, lng: p.lng, label: p.name }
      }
      return null
    }
    case "restaurant": {
      const p = places.restaurants.get(ref.id)
      if (!p) return null
      if (p.lat != null && p.lng != null) {
        return { lat: p.lat, lng: p.lng, label: p.name }
      }
      return null
    }
    case "groceryStore": {
      const p = places.groceryStores.get(ref.id)
      if (!p) return null
      if (p.lat != null && p.lng != null) {
        return { lat: p.lat, lng: p.lng, label: p.name }
      }
      return null
    }
    case "lodging": {
      const acc = accommodations[ref.accommodationIndex]
      if (!acc) return null
      const name = acc.name ?? "לינה"
      if (acc.coordinates?.lat != null && acc.coordinates?.lng != null) {
        return {
          lat: acc.coordinates.lat,
          lng: acc.coordinates.lng,
          label: name,
        }
      }
      if (acc.address) {
        const g = await geocodeAddress(acc.address)
        if (g) return { ...g, label: name }
      }
      return null
    }
    case "flight": {
      const leg = ref.leg === "outbound" ? flights[0] : flights[1]
      if (!leg) return null
      const airport =
        ref.point === "departure" ? leg.departureAirport : leg.arrivalAirport
      if (!airport) return null
      const label =
        ref.point === "departure"
          ? `המראה ${airport}`
          : `נחיתה ${airport}`
      const g = await geocodeAddress(`${airport} airport`)
      if (!g) return null
      return { ...g, label }
    }
    case "carRental": {
      const rental = carRentals[ref.rentalIndex]
      if (!rental) return null
      const addr =
        ref.point === "pickup" ? rental.pickupLocation : rental.returnLocation
      const label =
        ref.point === "pickup"
          ? `איסוף רכב${rental.company ? ` (${rental.company})` : ""}`
          : `החזרת רכב${rental.company ? ` (${rental.company})` : ""}`
      if (!addr) return null
      const g = await geocodeAddress(addr)
      if (!g) return null
      return { ...g, label }
    }
  }
}

export async function buildTravelLegForSave(
  origin: TravelEndpointRef,
  destination: TravelEndpointRef,
  places: PlaceMaps,
  accommodations: Accommodation[],
  flights: FlightLeg[],
  carRentals: CarRental[]
): Promise<TravelLegStored | null> {
  const [a, b] = await Promise.all([
    resolveTravelEndpoint(origin, places, accommodations, flights, carRentals),
    resolveTravelEndpoint(destination, places, accommodations, flights, carRentals),
  ])
  if (!a || !b) return null

  let driveMinutes: number | undefined
  try {
    const route = await calculateRoute(
      { lat: a.lat, lng: a.lng },
      { lat: b.lat, lng: b.lng }
    )
    driveMinutes = route.durationMinutes
  } catch {
    driveMinutes = undefined
  }

  return {
    origin,
    destination,
    driveMinutes,
    resolvedOrigin: { lat: a.lat, lng: a.lng, label: a.label },
    resolvedDestination: { lat: b.lat, lng: b.lng, label: b.label },
  }
}

export function placeMapsFromTrip(
  attractions: PlaceRow[],
  restaurants: PlaceRow[],
  groceryStores: PlaceRow[]
): PlaceMaps {
  return {
    attractions: new Map(attractions.map((a) => [a.id, a])),
    restaurants: new Map(restaurants.map((r) => [r.id, r])),
    groceryStores: new Map(groceryStores.map((g) => [g.id, g])),
  }
}
