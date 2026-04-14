export type TravelEndpointRef =
  | { kind: "attraction"; id: string }
  | { kind: "restaurant"; id: string }
  | { kind: "groceryStore"; id: string }
  | { kind: "lodging"; accommodationIndex: number }
  | { kind: "flight"; leg: "outbound" | "return"; point: "departure" | "arrival" }
  | { kind: "carRental"; rentalIndex: number; point: "pickup" | "return" }

export interface TravelLegStored {
  origin: TravelEndpointRef
  destination: TravelEndpointRef
  driveMinutes?: number
  resolvedOrigin?: { lat: number; lng: number; label: string }
  resolvedDestination?: { lat: number; lng: number; label: string }
}

export type ActivityTravelLegJson = TravelLegStored | null

export function parseTravelLegJson(value: unknown): TravelLegStored | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null
  const o = value as Record<string, unknown>
  if (!o.origin || !o.destination) return null
  return value as TravelLegStored
}
