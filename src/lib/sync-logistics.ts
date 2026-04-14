import { prisma } from "@/lib/prisma"
import { normalizeFlights, normalizeCarRentals, type FlightLeg, type CarRental } from "./normalizers"

// === Time helpers ===

/** Parse "HH:mm" into total minutes since midnight */
function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number)
  return h * 60 + m
}

/** Format total minutes since midnight back to "HH:mm" (clamped to 00:00–23:59) */
function formatTime(totalMinutes: number): string {
  let clamped = totalMinutes
  if (clamped < 0) clamped = 0
  if (clamped > 23 * 60 + 59) clamped = 23 * 60 + 59
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Subtract minutes from an "HH:mm" string, returning "HH:mm" */
function subtractMinutes(timeStr: string, minutes: number): string {
  return formatTime(parseTime(timeStr) - minutes)
}

/** Add minutes to an "HH:mm" string, returning "HH:mm" */
function addMinutes(timeStr: string, minutes: number): string {
  return formatTime(parseTime(timeStr) + minutes)
}

/** Extract "HH:mm" from a datetime string (local time — no timezone suffix) */
function isoToTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** Extract "YYYY-MM-DD" from a datetime string (local time — no timezone suffix) */
function isoToDateStr(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// === Logistics activity types ===

const LOGISTICS_TYPES = [
  "flight_departure",
  "flight_arrival",
  "car_pickup",
  "car_return",
] as const

// === Main function ===

export async function syncLogisticsActivities(
  tripId: string,
  userId: string
): Promise<void> {
  // 1. Load trip with flights, carRental, and dayPlans (with activities)
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId },
    include: {
      dayPlans: {
        include: { activities: true },
      },
    },
  })

  if (!trip) {
    throw new Error("Trip not found")
  }

  // 2. Load user's FamilyProfile for duration settings
  const familyProfile = await prisma.familyProfile.findUnique({
    where: { userId },
  })

  const preFlightArrivalMinutes = familyProfile?.preFlightArrivalMinutes ?? 180
  const carPickupDurationMinutes =
    familyProfile?.carPickupDurationMinutes ?? 120
  const carReturnDurationMinutes =
    familyProfile?.carReturnDurationMinutes ?? 60

  // 3. Delete all existing logistics activities for this trip
  const dayPlanIds = trip.dayPlans.map((dp) => dp.id)

  if (dayPlanIds.length > 0) {
    await prisma.activity.deleteMany({
      where: {
        dayPlanId: { in: dayPlanIds },
        type: { in: [...LOGISTICS_TYPES] },
      },
    })
  }

  // 4. Build a date-to-dayPlan lookup (using local time to match flight datetime format)
  const dayPlanByDate = new Map<string, string>()
  for (const dp of trip.dayPlans) {
    const d = dp.date
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    dayPlanByDate.set(dateStr, dp.id)
  }

  const activitiesToCreate: {
    dayPlanId: string
    sortOrder: number
    timeStart: string | null
    timeEnd: string | null
    type: string
    notes: string | null
  }[] = []

  // Helper to join non-empty parts with " - "
  function joinNotes(...parts: (string | undefined | null)[]): string | null {
    const filtered = parts.filter(Boolean) as string[]
    return filtered.length > 0 ? filtered.join(" - ") : null
  }

  const flights = normalizeFlights(trip.flights)
    .filter((f) => f.departureTime || f.arrivalTime)
    .sort((a, b) => {
      const aTime = a.departureTime || a.arrivalTime || ""
      const bTime = b.departureTime || b.arrivalTime || ""
      return aTime.localeCompare(bTime)
    })

  // === Flight activities ===
  for (let i = 0; i < flights.length; i++) {
    const flight = flights[i]

    if (flight.departureTime) {
      const dateStr = isoToDateStr(flight.departureTime)
      const dayPlanId = dayPlanByDate.get(dateStr)
      if (dayPlanId) {
        const depTime = isoToTime(flight.departureTime)
        activitiesToCreate.push({
          dayPlanId,
          sortOrder: i * 10,
          timeStart: subtractMinutes(depTime, preFlightArrivalMinutes),
          timeEnd: depTime,
          type: "flight_departure",
          notes: joinNotes(flight.flightNumber, flight.departureAirport),
        })
      }
    }

    if (flight.arrivalTime) {
      const dateStr = isoToDateStr(flight.arrivalTime)
      const dayPlanId = dayPlanByDate.get(dateStr)
      if (dayPlanId) {
        activitiesToCreate.push({
          dayPlanId,
          sortOrder: i * 10 + 1,
          timeStart: isoToTime(flight.arrivalTime),
          timeEnd: null,
          type: "flight_arrival",
          notes: joinNotes(flight.flightNumber, flight.arrivalAirport),
        })
      }
    }
  }

  const carRentals = normalizeCarRentals(trip.carRental)

  for (let j = 0; j < carRentals.length; j++) {
    const rental = carRentals[j]

    // === Car pickup ===
    if (rental.company || rental.pickupLocation) {
      let pickupDateStr: string
      let pickupTimeStart: string | null = null

      if (rental.pickupTime) {
        pickupDateStr = isoToDateStr(rental.pickupTime)
        pickupTimeStart = isoToTime(rental.pickupTime)
      } else if ((flights.length === 0 || flights.length === 2) && flights[0]?.arrivalTime) {
        pickupDateStr = isoToDateStr(flights[0].arrivalTime)
        pickupTimeStart = isoToTime(flights[0].arrivalTime)
      } else {
        const sd = trip.startDate
        pickupDateStr = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}-${String(sd.getDate()).padStart(2, "0")}`
      }

      const dayPlanId = dayPlanByDate.get(pickupDateStr)
      if (dayPlanId) {
        activitiesToCreate.push({
          dayPlanId,
          sortOrder: 500 + j * 10,
          timeStart: pickupTimeStart,
          timeEnd: pickupTimeStart !== null
            ? addMinutes(pickupTimeStart, carPickupDurationMinutes)
            : null,
          type: "car_pickup",
          notes: joinNotes(rental.company, rental.pickupLocation),
        })
      }
    }

    // === Car return ===
    if (rental.company || rental.returnLocation) {
      let returnDateStr: string
      let returnTimeStart: string | null = null

      if (rental.returnTime) {
        returnDateStr = isoToDateStr(rental.returnTime)
        returnTimeStart = isoToTime(rental.returnTime)
      } else if ((flights.length === 0 || flights.length === 2) && flights[flights.length - 1]?.departureTime) {
        const lastFlight = flights[flights.length - 1]
        returnDateStr = isoToDateStr(lastFlight.departureTime!)
        const depTime = isoToTime(lastFlight.departureTime!)
        returnTimeStart = subtractMinutes(depTime, preFlightArrivalMinutes + carReturnDurationMinutes)
      } else {
        const ed = trip.endDate
        returnDateStr = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, "0")}-${String(ed.getDate()).padStart(2, "0")}`
      }

      const dayPlanId = dayPlanByDate.get(returnDateStr)
      if (dayPlanId) {
        activitiesToCreate.push({
          dayPlanId,
          sortOrder: 500 + j * 10 + 1,
          timeStart: returnTimeStart,
          timeEnd: returnTimeStart !== null
            ? addMinutes(returnTimeStart, carReturnDurationMinutes)
            : null,
          type: "car_return",
          notes: joinNotes(rental.company, rental.returnLocation),
        })
      }
    }
  }

  // 5. Create all logistics activities in one batch
  if (activitiesToCreate.length > 0) {
    await prisma.activity.createMany({
      data: activitiesToCreate,
    })

    // 6. Re-sort all activities on affected day plans by timeStart
    const affectedDayPlanIds = [
      ...new Set(activitiesToCreate.map((a) => a.dayPlanId)),
    ]
    await resortActivitiesByTime(affectedDayPlanIds)
  }
}

/**
 * Re-sort all activities on the given day plans by timeStart,
 * so they appear in chronological order regardless of insertion order.
 */
export async function resortActivitiesByTime(
  dayPlanIds: string[]
): Promise<void> {
  for (const dayPlanId of dayPlanIds) {
    const activities = await prisma.activity.findMany({
      where: { dayPlanId },
      orderBy: { sortOrder: "asc" },
    })

    const sorted = [...activities].sort((a, b) => {
      if (!a.timeStart && !b.timeStart) return a.sortOrder - b.sortOrder
      if (!a.timeStart) return 1
      if (!b.timeStart) return -1
      return a.timeStart.localeCompare(b.timeStart)
    })

    // Update sortOrder for any activity whose position changed
    const updates = sorted
      .map((activity, index) => ({ id: activity.id, sortOrder: index }))
      .filter(
        (item) =>
          item.sortOrder !==
          activities.find((a) => a.id === item.id)!.sortOrder
      )

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.activity.update({
            where: { id: u.id },
            data: { sortOrder: u.sortOrder },
          })
        )
      )
    }
  }
}
