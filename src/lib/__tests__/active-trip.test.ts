import {
  localTodayISO,
  tripDayISO,
  isTripInProgress,
  resolveEntryTrip,
  pickInitialDay,
} from "../active-trip"

/** UTC-midnight date-only form, as the API returns startDate / endDate. */
function utcDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString()
}

describe("localTodayISO", () => {
  // Built from the local-time constructor so the expectation holds in whatever
  // zone the test runner happens to be in — which is the whole point of the
  // function: it must follow the device, not UTC.
  it("reads the device's local calendar day", () => {
    expect(localTodayISO(new Date(2026, 8, 2, 1, 0))).toBe("2026-09-02")
  })

  it("stays on the local day even when UTC has already rolled over", () => {
    expect(localTodayISO(new Date(2026, 8, 2, 23, 30))).toBe("2026-09-02")
  })

  it("pads single-digit months and days", () => {
    expect(localTodayISO(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05")
  })
})

describe("tripDayISO", () => {
  it("reads a UTC-midnight column in UTC", () => {
    expect(tripDayISO(utcDate(2026, 9, 3))).toBe("2026-09-03")
  })

  it("accepts a Date", () => {
    expect(tripDayISO(new Date(utcDate(2026, 12, 25)))).toBe("2026-12-25")
  })

  it("returns an empty string for an unparseable value", () => {
    expect(tripDayISO("not a date")).toBe("")
  })
})

describe("isTripInProgress", () => {
  const trip = {
    id: "t",
    startDate: utcDate(2026, 9, 1),
    endDate: utcDate(2026, 9, 10),
  }

  it("is true on the first day", () => {
    expect(isTripInProgress(trip, new Date(2026, 8, 1, 12, 0))).toBe(true)
  })

  it("is true on the last day", () => {
    expect(isTripInProgress(trip, new Date(2026, 8, 10, 20, 0))).toBe(true)
  })

  it("is false the day before it starts", () => {
    expect(isTripInProgress(trip, new Date(2026, 7, 31, 12, 0))).toBe(false)
  })

  it("is false the day after it ends", () => {
    expect(isTripInProgress(trip, new Date(2026, 8, 11, 0, 30))).toBe(false)
  })
})

describe("resolveEntryTrip", () => {
  const past = { id: "past", startDate: utcDate(2025, 1, 1), endDate: utcDate(2025, 1, 5) }
  const current = { id: "current", startDate: utcDate(2026, 8, 28), endDate: utcDate(2026, 9, 4) }
  const soon = { id: "soon", startDate: utcDate(2026, 10, 1), endDate: utcDate(2026, 10, 8) }
  const later = { id: "later", startDate: utcDate(2027, 3, 1), endDate: utcDate(2027, 3, 9) }

  const NOW = new Date(2026, 8, 1, 9, 0)

  it("prefers an in-progress trip", () => {
    expect(resolveEntryTrip([past, current, soon], NOW)).toEqual({
      trip: current,
      phase: "in-progress",
    })
  })

  it("falls back to the nearest upcoming trip", () => {
    expect(resolveEntryTrip([past, later, soon], NOW)).toEqual({
      trip: soon,
      phase: "upcoming",
    })
  })

  it("returns null when every trip is over", () => {
    expect(resolveEntryTrip([past], NOW)).toBeNull()
  })

  it("returns null for an empty list", () => {
    expect(resolveEntryTrip([], NOW)).toBeNull()
  })

  it("keeps a trip in progress late on its last local evening", () => {
    // The trip's endDate is stored at UTC midnight while the traveller is late
    // in their own 4th of September. Reading endDate locally would have ended
    // the trip a day early for anyone west of UTC.
    expect(resolveEntryTrip([current], new Date(2026, 8, 4, 23, 30))).toEqual({
      trip: current,
      phase: "in-progress",
    })
  })

  it("ends the trip on the traveller's own next morning", () => {
    expect(resolveEntryTrip([current], new Date(2026, 8, 5, 7, 0))).toBeNull()
  })
})

describe("pickInitialDay", () => {
  // A trip running 2026-09-01 .. 2026-09-04, days stored at UTC midnight.
  const days = [1, 2, 3, 4].map((d) => ({ id: `d${d}`, date: utcDate(2026, 9, d) }))

  it("opens on today when the trip is in progress", () => {
    expect(pickInitialDay(days, null, new Date(2026, 8, 3, 10, 0))).toBe("d3")
  })

  it("opens on today late in the local evening, when UTC has already rolled over", () => {
    expect(pickInitialDay(days, null, new Date(2026, 8, 3, 23, 45))).toBe("d3")
  })

  it("prefers a day pinned in the URL over today", () => {
    expect(pickInitialDay(days, "2026-09-01", new Date(2026, 8, 3, 10, 0))).toBe("d1")
  })

  it("ignores a pinned day that is not part of this trip", () => {
    expect(pickInitialDay(days, "2025-01-01", new Date(2026, 8, 3, 10, 0))).toBe("d3")
  })

  it("falls back to the first day for a trip that has ended", () => {
    expect(pickInitialDay(days, null, new Date(2026, 9, 20, 10, 0))).toBe("d1")
  })

  it("falls back to the first day for a trip that has not started", () => {
    expect(pickInitialDay(days, null, new Date(2026, 7, 1, 10, 0))).toBe("d1")
  })

  it("returns null when there are no days yet", () => {
    expect(pickInitialDay([], null, new Date(2026, 8, 3))).toBeNull()
  })
})
