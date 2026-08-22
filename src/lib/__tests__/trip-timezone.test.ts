import { zonedDateTimeToUtc } from "../trip-timezone"

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
