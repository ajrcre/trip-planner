import { buildWarmUrls, isTripActive, selectActiveTrips } from "../offline-sync"

const NOW = new Date("2026-08-18T09:00:00.000Z")

/** The UTC-midnight date-only form the API actually returns for endDate. */
function endDate(daysFromNow: number): string {
  const d = new Date(Date.UTC(2026, 7, 18))
  d.setUTCDate(d.getUTCDate() + daysFromNow)
  return d.toISOString()
}

describe("isTripActive", () => {
  it("includes a trip still to come", () => {
    expect(isTripActive({ id: "t", endDate: endDate(14) }, NOW)).toBe(true)
  })

  it("includes a trip ending today, all day", () => {
    // Someone flying home this evening still needs the schedule after the end
    // timestamp itself has passed.
    expect(isTripActive({ id: "t", endDate: endDate(0) }, NOW)).toBe(true)
  })

  it("keeps a trip one extra day, absorbing the device's timezone offset", () => {
    // The grace day is what stops a traveller west of UTC losing their cache
    // while the trip is still running. Costing a day of stale cache is the
    // cheap side of that trade.
    expect(isTripActive({ id: "t", endDate: endDate(-1) }, NOW)).toBe(true)
  })

  it("excludes a trip that is properly over", () => {
    expect(isTripActive({ id: "t", endDate: endDate(-3) }, NOW)).toBe(false)
  })

  it("is not skewed by the device timezone", () => {
    // Same instant, two travellers 22 hours apart. Both are mid-trip, so both
    // must keep the trip cached.
    const end = endDate(1)
    const farWest = new Date("2026-08-18T02:00:00.000Z")
    const farEast = new Date("2026-08-18T23:00:00.000Z")

    expect(isTripActive({ id: "t", endDate: end }, farWest)).toBe(true)
    expect(isTripActive({ id: "t", endDate: end }, farEast)).toBe(true)
  })

  it("excludes a trip with an unparseable end date rather than caching it", () => {
    expect(isTripActive({ id: "t", endDate: "not a date" }, NOW)).toBe(false)
  })

  it("accepts a Date as well as a string", () => {
    expect(isTripActive({ id: "t", endDate: new Date(endDate(14)) }, NOW)).toBe(true)
  })
})

describe("selectActiveTrips", () => {
  it("keeps only trips that have not ended", () => {
    const trips = [
      { id: "past", endDate: endDate(-200) },
      { id: "current", endDate: endDate(2) },
      { id: "future", endDate: endDate(150) },
    ]

    expect(selectActiveTrips(trips, NOW).map((t) => t.id)).toEqual(["current", "future"])
  })
})

describe("buildWarmUrls", () => {
  it("puts the session first — without it every page redirects to sign-in", () => {
    expect(buildWarmUrls([])[0]).toBe("/api/auth/session")
  })

  it("warms the global shells and endpoints even with no active trips", () => {
    expect(buildWarmUrls([])).toEqual([
      "/api/auth/session",
      "/api/trips",
      "/trips",
      "/trips/new",
      "/family",
      "/api/family",
    ])
  })

  it("includes the page shell and every tab's endpoint for each trip", () => {
    const urls = buildWarmUrls(["t1"])

    expect(urls).toEqual(
      expect.arrayContaining([
        "/trips/t1",
        "/api/trips/t1",
        "/api/trips/t1/attractions",
        "/api/trips/t1/restaurants",
        "/api/trips/t1/grocery-stores",
        "/api/trips/t1/schedule",
        "/api/trips/t1/weather",
        "/api/trips/t1/profile",
        "/api/trips/t1/packing",
        "/api/trips/t1/shopping",
        "/api/trips/t1/todos",
        "/api/trips/t1/members",
      ])
    )
  })

  it("orders a trip's shell before its data, so a dying connection still leaves a usable page", () => {
    const urls = buildWarmUrls(["t1"])
    expect(urls.indexOf("/trips/t1")).toBeLessThan(urls.indexOf("/api/trips/t1"))
  })

  it("covers every trip it is given", () => {
    const urls = buildWarmUrls(["t1", "t2"])
    expect(urls).toContain("/trips/t2")
    expect(urls).toContain("/api/trips/t2/schedule")
  })

  it("emits no duplicates", () => {
    const urls = buildWarmUrls(["t1", "t2"])
    expect(new Set(urls).size).toBe(urls.length)
  })
})
