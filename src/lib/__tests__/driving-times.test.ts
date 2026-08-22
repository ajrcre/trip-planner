import { computeDrivingTimesForDay, clearRouteCache } from "../driving-times"

// Mock google-maps, but keep the real isUsableDepartureTime — driving-times.ts
// relies on its actual 60-second-margin semantics against the (possibly faked)
// system clock, not a test double.
jest.mock("../google-maps", () => ({
  ...jest.requireActual("../google-maps"),
  calculateRoute: jest.fn(),
}))

jest.mock("../trip-timezone", () => ({
  departureInstant: jest.fn(),
}))

import { calculateRoute } from "../google-maps"
import { departureInstant } from "../trip-timezone"

const mockedCalculateRoute = calculateRoute as jest.MockedFunction<typeof calculateRoute>
const mockedDepartureInstant = departureInstant as jest.MockedFunction<
  typeof departureInstant
>

describe("computeDrivingTimesForDay", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearRouteCache()
  })

  it("returns empty array when activity has no coordinates", async () => {
    const accommodations = [
      { name: "Hotel A", coordinates: { lat: 1, lng: 2 } },
    ]
    const activity = {
      attraction: null,
      restaurant: null,
      groceryStore: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([])
    expect(mockedCalculateRoute).not.toHaveBeenCalled()
  })

  it("returns empty array when no accommodations have coordinates", async () => {
    const accommodations = [{ name: "Hotel A" }]
    const activity = {
      attraction: { lat: 3, lng: 4 },
      restaurant: null,
      groceryStore: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([])
  })

  it("returns driving time from one accommodation to attraction", async () => {
    mockedCalculateRoute.mockResolvedValue({ durationMinutes: 25, distanceKm: 18.5 })

    const accommodations = [
      { name: "Hotel A", coordinates: { lat: 1, lng: 2 } },
    ]
    const activity = {
      attraction: { lat: 3, lng: 4 },
      restaurant: null,
      groceryStore: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([
      { accommodationName: "Hotel A", minutes: 25 },
    ])
    expect(mockedCalculateRoute).toHaveBeenCalledWith({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })
  })

  it("returns driving time from accommodation to restaurant", async () => {
    mockedCalculateRoute.mockResolvedValue({ durationMinutes: 10, distanceKm: 5.0 })

    const accommodations = [
      { name: "Hotel B", coordinates: { lat: 5, lng: 6 } },
    ]
    const activity = {
      attraction: null,
      restaurant: { lat: 7, lng: 8 },
      groceryStore: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([
      { accommodationName: "Hotel B", minutes: 10 },
    ])
  })

  it("returns two driving times when day has two accommodations (travel day)", async () => {
    mockedCalculateRoute
      .mockResolvedValueOnce({ durationMinutes: 30, distanceKm: 20 })
      .mockResolvedValueOnce({ durationMinutes: 15, distanceKm: 10 })

    const accommodations = [
      { name: "Hotel Checkout", coordinates: { lat: 1, lng: 2 } },
      { name: "Hotel Checkin", coordinates: { lat: 5, lng: 6 } },
    ]
    const activity = {
      attraction: { lat: 3, lng: 4 },
      restaurant: null,
      groceryStore: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([
      { accommodationName: "Hotel Checkout", minutes: 30 },
      { accommodationName: "Hotel Checkin", minutes: 15 },
    ])
  })

  it("prefers attraction coordinates over restaurant when both exist", async () => {
    mockedCalculateRoute.mockResolvedValue({ durationMinutes: 20, distanceKm: 12 })

    const accommodations = [
      { name: "Hotel", coordinates: { lat: 1, lng: 2 } },
    ]
    const activity = {
      attraction: { lat: 3, lng: 4 },
      restaurant: { lat: 5, lng: 6 },
      groceryStore: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([
      { accommodationName: "Hotel", minutes: 20 },
    ])
    expect(mockedCalculateRoute).toHaveBeenCalledWith({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })
  })

  it("caches route results for same origin-destination", async () => {
    mockedCalculateRoute.mockResolvedValue({ durationMinutes: 25, distanceKm: 18.5 })

    const accommodations = [{ name: "Hotel A", coordinates: { lat: 1, lng: 2 } }]
    const activity = { attraction: { lat: 3, lng: 4 }, restaurant: null, groceryStore: null }

    // Call twice
    await computeDrivingTimesForDay(accommodations, activity)
    await computeDrivingTimesForDay(accommodations, activity)

    // calculateRoute should only be called once due to cache
    expect(mockedCalculateRoute).toHaveBeenCalledTimes(1)
  })

  it("handles calculateRoute failure gracefully -- skips that pair", async () => {
    mockedCalculateRoute.mockRejectedValue(new Error("API error"))

    const accommodations = [
      { name: "Hotel A", coordinates: { lat: 1, lng: 2 } },
    ]
    const activity = {
      attraction: { lat: 3, lng: 4 },
      restaurant: null,
      groceryStore: null,
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([])
  })
})

describe("computeDrivingTimesForDay — departure times", () => {
  const accommodations = [{ name: "Hotel A", coordinates: { lat: 1, lng: 2 } }]
  const activity = {
    attraction: { lat: 3, lng: 4 },
    restaurant: null,
    groceryStore: null,
  }
  const when = { dayDate: new Date("2099-09-14T00:00:00.000Z"), timeStart: "09:00" }

  beforeEach(() => {
    jest.clearAllMocks()
    clearRouteCache()
    mockedCalculateRoute.mockResolvedValue({ durationMinutes: 25, distanceKm: 18.5 })
  })

  it("passes a future departure time through to calculateRoute", async () => {
    const departure = new Date("2099-09-14T07:00:00.000Z")
    mockedDepartureInstant.mockResolvedValue(departure)

    await computeDrivingTimesForDay(accommodations, activity, when)

    expect(mockedCalculateRoute).toHaveBeenCalledWith(
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
      { departureTime: departure }
    )
  })

  it("treats different departure hours as different cache entries", async () => {
    mockedDepartureInstant
      .mockResolvedValueOnce(new Date("2099-09-14T07:00:00.000Z"))
      .mockResolvedValueOnce(new Date("2099-09-14T12:00:00.000Z"))

    await computeDrivingTimesForDay(accommodations, activity, when)
    await computeDrivingTimesForDay(accommodations, activity, {
      ...when,
      timeStart: "14:00",
    })

    expect(mockedCalculateRoute).toHaveBeenCalledTimes(2)
  })

  it("shares a cache entry for the same departure hour", async () => {
    mockedDepartureInstant.mockResolvedValue(new Date("2099-09-14T07:00:00.000Z"))

    await computeDrivingTimesForDay(accommodations, activity, when)
    await computeDrivingTimesForDay(accommodations, activity, when)

    expect(mockedCalculateRoute).toHaveBeenCalledTimes(1)
  })

  it("omits the options argument entirely when there is no departure", async () => {
    mockedDepartureInstant.mockResolvedValue(undefined)

    await computeDrivingTimesForDay(accommodations, activity, when)

    // Exactly two arguments — a trailing `undefined` would break the
    // pre-existing two-argument assertions elsewhere in this file.
    expect(mockedCalculateRoute).toHaveBeenCalledWith(
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 }
    )
  })

  it("does not consult the timezone helper when `when` is omitted", async () => {
    await computeDrivingTimesForDay(accommodations, activity)
    expect(mockedDepartureInstant).not.toHaveBeenCalled()
  })

  it("does not send a past departure instant, and caches the result with the live TTL", async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000)
    mockedDepartureInstant.mockResolvedValue(past)

    await computeDrivingTimesForDay(accommodations, activity, when)

    // Two-argument form: a past departure is not "usable", so it must not
    // be sent — the same predicate calculateRoute itself uses.
    expect(mockedCalculateRoute).toHaveBeenCalledWith(
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 }
    )
  })
})

describe("computeDrivingTimesForDay — cache TTL expiry", () => {
  const accommodations = [{ name: "Hotel A", coordinates: { lat: 1, lng: 2 } }]
  const activity = {
    attraction: { lat: 3, lng: 4 },
    restaurant: null,
    groceryStore: null,
  }
  const when = { dayDate: new Date("2026-01-01T00:00:00.000Z"), timeStart: "09:00" }

  beforeEach(() => {
    jest.clearAllMocks()
    clearRouteCache()
    mockedCalculateRoute.mockResolvedValue({ durationMinutes: 25, distanceKm: 18.5 })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("keeps a future-dated entry cached past the 1-hour live TTL, and expires it past 24 hours", async () => {
    jest.useFakeTimers()
    const now = new Date("2026-01-01T00:00:00.000Z")
    jest.setSystemTime(now)

    // Well beyond the 60s "usable" margin measured against the faked clock.
    const departure = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    mockedDepartureInstant.mockResolvedValue(departure)

    await computeDrivingTimesForDay(accommodations, activity, when)
    expect(mockedCalculateRoute).toHaveBeenCalledTimes(1)

    // Past the 1-hour live TTL — a future-dated entry survives.
    jest.setSystemTime(new Date(now.getTime() + 90 * 60 * 1000))
    await computeDrivingTimesForDay(accommodations, activity, when)
    expect(mockedCalculateRoute).toHaveBeenCalledTimes(1)

    // Past the 24-hour future TTL — must be recomputed.
    jest.setSystemTime(new Date(now.getTime() + 25 * 60 * 60 * 1000))
    await computeDrivingTimesForDay(accommodations, activity, when)
    expect(mockedCalculateRoute).toHaveBeenCalledTimes(2)
  })

  it("expires a live-traffic (@live) entry after the 1-hour TTL", async () => {
    jest.useFakeTimers()
    const now = new Date("2026-01-01T00:00:00.000Z")
    jest.setSystemTime(now)

    mockedDepartureInstant.mockResolvedValue(undefined)

    await computeDrivingTimesForDay(accommodations, activity, when)
    expect(mockedCalculateRoute).toHaveBeenCalledTimes(1)

    jest.setSystemTime(new Date(now.getTime() + 61 * 60 * 1000))
    await computeDrivingTimesForDay(accommodations, activity, when)
    expect(mockedCalculateRoute).toHaveBeenCalledTimes(2)
  })
})

describe("computeDrivingTimesForDay — retries when departureTime is rejected", () => {
  const accommodations = [{ name: "Hotel A", coordinates: { lat: 1, lng: 2 } }]
  const activity = {
    attraction: { lat: 3, lng: 4 },
    restaurant: null,
    groceryStore: null,
  }
  const when = { dayDate: new Date("2099-09-14T00:00:00.000Z"), timeStart: "09:00" }

  beforeEach(() => {
    jest.clearAllMocks()
    clearRouteCache()
  })

  it("retries once without departureTime when the departure-time call rejects", async () => {
    const departure = new Date("2099-09-14T07:00:00.000Z")
    mockedDepartureInstant.mockResolvedValue(departure)

    mockedCalculateRoute
      .mockRejectedValueOnce(new Error("Route calculation failed: 400"))
      .mockResolvedValueOnce({ durationMinutes: 42, distanceKm: 30 })

    const result = await computeDrivingTimesForDay(accommodations, activity, when)

    expect(result).toEqual([{ accommodationName: "Hotel A", minutes: 42 }])
    expect(mockedCalculateRoute).toHaveBeenNthCalledWith(
      1,
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
      { departureTime: departure }
    )
    expect(mockedCalculateRoute).toHaveBeenNthCalledWith(
      2,
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 }
    )
  })
})
