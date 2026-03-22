import { prisma } from "@/lib/prisma"

// === JSON field interfaces ===

interface FlightLeg {
  flightNumber?: string
  departureAirport?: string
  departureTime?: string // ISO datetime string
  arrivalAirport?: string
  arrivalTime?: string // ISO datetime string
}

interface FlightsData {
  outbound?: FlightLeg
  return?: FlightLeg
}

interface CarRentalData {
  company?: string
  pickupLocation?: string
  returnLocation?: string
}

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

/** Extract "HH:mm" from an ISO datetime string */
function isoToTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** Extract "YYYY-MM-DD" from an ISO datetime string */
function isoToDateStr(iso: string): string {
  return new Date(iso).toISOString().split("T")[0]
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

  // 4. Build a date-to-dayPlan lookup
  const dayPlanByDate = new Map<string, string>()
  for (const dp of trip.dayPlans) {
    const dateStr = dp.date.toISOString().split("T")[0]
    dayPlanByDate.set(dateStr, dp.id)
  }

  const flights = (trip.flights as FlightsData | null) ?? {}
  const carRental = (trip.carRental as CarRentalData | null) ?? {}

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

  // === Flight departure (outbound) ===
  if (flights.outbound?.departureTime) {
    const dateStr = isoToDateStr(flights.outbound.departureTime)
    const dayPlanId = dayPlanByDate.get(dateStr)
    if (dayPlanId) {
      const depTime = isoToTime(flights.outbound.departureTime)
      activitiesToCreate.push({
        dayPlanId,
        sortOrder: 0,
        timeStart: subtractMinutes(depTime, preFlightArrivalMinutes),
        timeEnd: depTime,
        type: "flight_departure",
        notes: joinNotes(
          flights.outbound.flightNumber,
          flights.outbound.departureAirport
        ),
      })
    }
  }

  // === Flight arrival (outbound) ===
  if (flights.outbound?.arrivalTime) {
    const dateStr = isoToDateStr(flights.outbound.arrivalTime)
    const dayPlanId = dayPlanByDate.get(dateStr)
    if (dayPlanId) {
      activitiesToCreate.push({
        dayPlanId,
        sortOrder: 1,
        timeStart: isoToTime(flights.outbound.arrivalTime),
        timeEnd: null,
        type: "flight_arrival",
        notes: joinNotes(
          flights.outbound.flightNumber,
          flights.outbound.arrivalAirport
        ),
      })
    }
  }

  // === Flight departure (return) ===
  if (flights.return?.departureTime) {
    const dateStr = isoToDateStr(flights.return.departureTime)
    const dayPlanId = dayPlanByDate.get(dateStr)
    if (dayPlanId) {
      const depTime = isoToTime(flights.return.departureTime)
      activitiesToCreate.push({
        dayPlanId,
        sortOrder: 900,
        timeStart: subtractMinutes(depTime, preFlightArrivalMinutes),
        timeEnd: depTime,
        type: "flight_departure",
        notes: joinNotes(
          flights.return.flightNumber,
          flights.return.departureAirport
        ),
      })
    }
  }

  // === Flight arrival (return) ===
  if (flights.return?.arrivalTime) {
    const dateStr = isoToDateStr(flights.return.arrivalTime)
    const dayPlanId = dayPlanByDate.get(dateStr)
    if (dayPlanId) {
      activitiesToCreate.push({
        dayPlanId,
        sortOrder: 901,
        timeStart: isoToTime(flights.return.arrivalTime),
        timeEnd: null,
        type: "flight_arrival",
        notes: joinNotes(
          flights.return.flightNumber,
          flights.return.arrivalAirport
        ),
      })
    }
  }

  // === Car pickup ===
  if (carRental.company || carRental.pickupLocation) {
    // Day: same as outbound flight arrival date, or trip startDate
    let pickupDateStr: string
    let pickupTimeStart: string | null = null

    if (flights.outbound?.arrivalTime) {
      pickupDateStr = isoToDateStr(flights.outbound.arrivalTime)
      pickupTimeStart = isoToTime(flights.outbound.arrivalTime)
    } else {
      pickupDateStr = trip.startDate.toISOString().split("T")[0]
    }

    const dayPlanId = dayPlanByDate.get(pickupDateStr)
    if (dayPlanId) {
      activitiesToCreate.push({
        dayPlanId,
        sortOrder: 2,
        timeStart: pickupTimeStart,
        timeEnd:
          pickupTimeStart !== null
            ? addMinutes(pickupTimeStart, carPickupDurationMinutes)
            : null,
        type: "car_pickup",
        notes: joinNotes(carRental.company, carRental.pickupLocation),
      })
    }
  }

  // === Car return ===
  if (carRental.company || carRental.returnLocation) {
    let returnDateStr: string
    let returnTimeStart: string | null = null

    if (flights.return?.departureTime) {
      returnDateStr = isoToDateStr(flights.return.departureTime)
      const depTime = isoToTime(flights.return.departureTime)
      returnTimeStart = subtractMinutes(
        depTime,
        preFlightArrivalMinutes + carReturnDurationMinutes
      )
    } else {
      returnDateStr = trip.endDate.toISOString().split("T")[0]
    }

    const dayPlanId = dayPlanByDate.get(returnDateStr)
    if (dayPlanId) {
      activitiesToCreate.push({
        dayPlanId,
        sortOrder: 899,
        timeStart: returnTimeStart,
        timeEnd:
          returnTimeStart !== null
            ? addMinutes(returnTimeStart, carReturnDurationMinutes)
            : null,
        type: "car_return",
        notes: joinNotes(carRental.company, carRental.returnLocation),
      })
    }
  }

  // 5. Create all logistics activities in one batch
  if (activitiesToCreate.length > 0) {
    await prisma.activity.createMany({
      data: activitiesToCreate,
    })
  }
}
