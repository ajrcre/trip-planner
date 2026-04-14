import type { TravelEndpointRef } from "@/types/travel-leg"

/** Stable string for <select> values (URL-safe subset) */
export function encodeTravelEndpoint(ref: TravelEndpointRef): string {
  switch (ref.kind) {
    case "attraction":
      return `at:${ref.id}`
    case "restaurant":
      return `re:${ref.id}`
    case "groceryStore":
      return `gr:${ref.id}`
    case "lodging":
      return `lo:${ref.accommodationIndex}`
    case "flight":
      return `fl:${ref.leg}:${ref.point}`
    case "carRental":
      return `ca:${ref.rentalIndex}:${ref.point}`
  }
}

export function decodeTravelEndpoint(s: string): TravelEndpointRef | null {
  if (!s) return null
  if (s.startsWith("at:")) {
    const id = s.slice(3)
    return id ? { kind: "attraction", id } : null
  }
  if (s.startsWith("re:")) {
    const id = s.slice(3)
    return id ? { kind: "restaurant", id } : null
  }
  if (s.startsWith("gr:")) {
    const id = s.slice(3)
    return id ? { kind: "groceryStore", id } : null
  }
  if (s.startsWith("lo:")) {
    const n = parseInt(s.slice(3), 10)
    if (Number.isNaN(n)) return null
    return { kind: "lodging", accommodationIndex: n }
  }
  if (s.startsWith("fl:")) {
    const rest = s.slice(3)
    const [leg, point] = rest.split(":")
    if (leg !== "outbound" && leg !== "return") return null
    if (point !== "departure" && point !== "arrival") return null
    return { kind: "flight", leg, point }
  }
  if (s.startsWith("ca:")) {
    const rest = s.slice(3)
    const colon = rest.lastIndexOf(":")
    if (colon <= 0) return null
    const idx = parseInt(rest.slice(0, colon), 10)
    const point = rest.slice(colon + 1)
    if (Number.isNaN(idx) || (point !== "pickup" && point !== "return")) return null
    return { kind: "carRental", rentalIndex: idx, point }
  }
  return null
}
