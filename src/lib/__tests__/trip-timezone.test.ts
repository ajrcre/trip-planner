import {
  zonedDateTimeToUtc,
  resolveTimeZone,
  departureInstant,
  clearTimeZoneCache,
} from "../trip-timezone"

describe("zonedDateTimeToUtc", () => {
  it("converts a summer (CEST, UTC+2) wall-clock time", () => {
    const d = zonedDateTimeToUtc("2026-09-14", "09:00", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-09-14T07:00:00.000Z")
  })

  it("converts a winter (CET, UTC+1) wall-clock time", () => {
    const d = zonedDateTimeToUtc("2026-12-14", "09:00", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-12-14T08:00:00.000Z")
  })

  it("handles the spring-forward DST boundary", () => {
    // EU DST starts Sun 2026-03-29: 02:00 CET -> 03:00 CEST.
    // 09:00 that day is already CEST (UTC+2).
    const d = zonedDateTimeToUtc("2026-03-29", "09:00", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-03-29T07:00:00.000Z")
  })

  it("handles the fall-back DST boundary", () => {
    // EU DST ends Sun 2026-10-25: 03:00 CEST -> 02:00 CET.
    // 09:00 that day is CET (UTC+1).
    const d = zonedDateTimeToUtc("2026-10-25", "09:00", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-10-25T08:00:00.000Z")
  })

  it("resolves a nonexistent spring-forward local time forward", () => {
    // 2026-03-29: Rome jumps 02:00 CET -> 03:00 CEST, so 02:30 never occurs.
    // The two-pass correction resolves it to 03:30 CEST.
    const d = zonedDateTimeToUtc("2026-03-29", "02:30", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-03-29T01:30:00.000Z")
  })

  it("resolves an ambiguous fall-back local time to its first occurrence", () => {
    // 2026-10-25: Rome repeats 02:00-03:00 when CEST -> CET. 01:30 resolves
    // to the CEST (UTC+2) reading.
    const d = zonedDateTimeToUtc("2026-10-25", "01:30", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-10-24T23:30:00.000Z")
  })

  it("handles a negative UTC offset", () => {
    const d = zonedDateTimeToUtc("2026-09-14", "09:00", "America/New_York")
    expect(d.toISOString()).toBe("2026-09-14T13:00:00.000Z")
  })

  it("handles midnight without rolling to the next day", () => {
    const d = zonedDateTimeToUtc("2026-09-14", "00:00", "Europe/Rome")
    expect(d.toISOString()).toBe("2026-09-13T22:00:00.000Z")
  })

  it("throws on an unparseable date or time", () => {
    expect(() => zonedDateTimeToUtc("not-a-date", "09:00", "Europe/Rome")).toThrow()
  })
})

describe("resolveTimeZone", () => {
  const originalFetch = global.fetch
  const originalKey = process.env.GOOGLE_MAPS_API_KEY

  beforeEach(() => {
    clearTimeZoneCache()
    process.env.GOOGLE_MAPS_API_KEY = "test-key"
    global.fetch = jest.fn() as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.GOOGLE_MAPS_API_KEY = originalKey
  })

  const mockOk = (timeZoneId: string) =>
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "OK", timeZoneId }),
    })

  it("returns the IANA id for a coordinate", async () => {
    mockOk("Europe/Rome")
    await expect(resolveTimeZone({ lat: 41.9, lng: 12.5 })).resolves.toBe("Europe/Rome")
  })

  it("caches by rounded coordinates so nearby points share one lookup", async () => {
    mockOk("Europe/Rome")
    await resolveTimeZone({ lat: 41.902, lng: 12.496 })
    await resolveTimeZone({ lat: 41.918, lng: 12.502 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("issues separate lookups for distant coordinates", async () => {
    mockOk("Europe/Rome")
    await resolveTimeZone({ lat: 41.9, lng: 12.5 })
    await resolveTimeZone({ lat: 48.9, lng: 2.4 })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it("returns null when the API reports a non-OK status", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS" }),
    })
    await expect(resolveTimeZone({ lat: 0, lng: 0 })).resolves.toBeNull()
  })

  it("returns null when the request throws", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("network"))
    await expect(resolveTimeZone({ lat: 1, lng: 2 })).resolves.toBeNull()
  })

  it("retries after a transient failure instead of caching it", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network"))
    await expect(resolveTimeZone({ lat: 41.9, lng: 12.5 })).resolves.toBeNull()

    mockOk("Europe/Rome")
    await expect(resolveTimeZone({ lat: 41.9, lng: 12.5 })).resolves.toBe(
      "Europe/Rome"
    )
  })
})

describe("departureInstant", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    clearTimeZoneCache()
    process.env.GOOGLE_MAPS_API_KEY = "test-key"
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "OK", timeZoneId: "Europe/Rome" }),
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("combines the day date and start time into a UTC instant", async () => {
    const d = await departureInstant(
      new Date("2026-09-14T00:00:00.000Z"),
      "09:00",
      { lat: 41.9, lng: 12.5 }
    )
    expect(d?.toISOString()).toBe("2026-09-14T07:00:00.000Z")
  })

  it("returns undefined when there is no start time", async () => {
    const d = await departureInstant(
      new Date("2026-09-14T00:00:00.000Z"),
      null,
      { lat: 41.9, lng: 12.5 }
    )
    expect(d).toBeUndefined()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("returns undefined when the timezone cannot be resolved", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("network"))
    const d = await departureInstant(
      new Date("2026-09-14T00:00:00.000Z"),
      "09:00",
      { lat: 41.9, lng: 12.5 }
    )
    expect(d).toBeUndefined()
  })

  it("returns undefined rather than throwing when dayDate is invalid", async () => {
    const d = await departureInstant(new Date(NaN), "09:00", {
      lat: 41.9,
      lng: 12.5,
    })
    expect(d).toBeUndefined()
  })
})
