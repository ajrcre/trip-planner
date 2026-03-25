export interface FlightLeg {
  flightNumber?: string | null
  departureAirport?: string | null
  departureTime?: string | null
  arrivalAirport?: string | null
  arrivalTime?: string | null
}

export interface CarRental {
  company?: string | null
  pickupLocation?: string | null
  pickupTime?: string | null
  returnLocation?: string | null
  returnTime?: string | null
  additionalDetails?: string | null
}

function isNonEmptyLeg(leg: unknown): leg is FlightLeg {
  if (!leg || typeof leg !== "object") return false
  const l = leg as Record<string, unknown>
  return !!(l.flightNumber || l.departureAirport || l.departureTime || l.arrivalAirport || l.arrivalTime)
}

export function normalizeFlights(data: unknown): FlightLeg[] {
  if (data == null) return []
  if (Array.isArray(data)) return data as FlightLeg[]
  if (typeof data === "object" && ("outbound" in data || "return" in data)) {
    const old = data as { outbound?: unknown; return?: unknown }
    const legs: FlightLeg[] = []
    if (isNonEmptyLeg(old.outbound)) legs.push(old.outbound)
    if (isNonEmptyLeg(old.return)) legs.push(old.return)
    return legs
  }
  return []
}

export function normalizeCarRentals(data: unknown): CarRental[] {
  if (data == null) return []
  if (Array.isArray(data)) return data as CarRental[]
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>
    const hasContent = !!(obj.company || obj.pickupLocation || obj.returnLocation || obj.additionalDetails || obj.pickupTime || obj.returnTime)
    return hasContent ? [data as CarRental] : []
  }
  return []
}
