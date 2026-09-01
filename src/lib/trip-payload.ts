import { prisma } from "@/lib/prisma"
import { normalizeAccommodations } from "@/lib/accommodations"
import { normalizeFlights, normalizeCarRentals } from "@/lib/normalizers"
import { geocodeAddress } from "@/lib/google-maps"
import { verifyTripAccess } from "@/lib/trip-access"

/**
 * The full trip payload the dashboard renders from, shared by the server page
 * and GET /api/trips/[tripId] so the two can never drift.
 */
export async function getTripPayload(tripId: string, userId: string) {
  const access = await verifyTripAccess(tripId, userId)
  if (!access) return null

  const fullTrip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      attractions: true,
      restaurants: true,
      groceryStores: true,
      dayPlans: {
        include: { activities: true },
      },
      packingItems: true,
      shoppingItems: true,
    },
  })
  if (!fullTrip) return null

  return {
    ...fullTrip,
    flights: normalizeFlights(fullTrip.flights),
    carRental: normalizeCarRentals(fullTrip.carRental),
    role: access.role,
  }
}

export type TripPayload = NonNullable<Awaited<ReturnType<typeof getTripPayload>>>

/**
 * Fills in coordinates for accommodations that were entered as an address.
 *
 * Kept out of `getTripPayload` on purpose: it calls Google per address, and the
 * first paint of a trip must not wait on it. The page renders with whatever
 * coordinates are already stored (a map pin may be missing for one load) and
 * this runs on the API path, which persists the result so the next load has it.
 */
export async function backfillAccommodationCoords(
  tripId: string,
  accommodation: unknown
): Promise<unknown> {
  const accommodations = normalizeAccommodations(accommodation)
  if (!accommodations.some((a) => a.address && !a.coordinates)) return accommodation

  const geocoded = await Promise.all(
    accommodations.map(async (acc) => {
      if (acc.address && !acc.coordinates) {
        const coords = await geocodeAddress(acc.address)
        if (coords) return { ...acc, coordinates: coords }
      }
      return acc
    })
  )

  // Persist in the background so future loads are instant.
  prisma.trip
    .update({
      where: { id: tripId },
      data: { accommodation: JSON.parse(JSON.stringify(geocoded)) },
    })
    .catch(() => {})

  return geocoded
}
