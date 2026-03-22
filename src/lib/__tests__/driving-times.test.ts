import { computeDrivingTimesForDay, clearRouteCache } from "../driving-times"

// Mock google-maps
jest.mock("../google-maps", () => ({
  calculateRoute: jest.fn(),
}))

import { calculateRoute } from "../google-maps"

const mockedCalculateRoute = calculateRoute as jest.MockedFunction<typeof calculateRoute>

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
    const activity = { attraction: { lat: 3, lng: 4 }, restaurant: null }

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
    }

    const result = await computeDrivingTimesForDay(accommodations, activity)
    expect(result).toEqual([])
  })
})
