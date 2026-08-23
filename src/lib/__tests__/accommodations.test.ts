import {
  getAccommodationsForDay,
  hasUnparseableDates,
  type Accommodation,
} from "../accommodations"

const sinaia: Accommodation = {
  name: "Hotel Sinaia",
  checkIn: "2026-08-24T15:00",
  checkOut: "2026-08-25T12:00",
  coordinates: { lat: 45.35, lng: 25.55 },
}

const bran: Accommodation = {
  name: "Casa din vale",
  checkIn: "2026-08-25T14:00",
  checkOut: "2026-08-30T12:00",
  coordinates: { lat: 45.53, lng: 25.4 },
}

describe("getAccommodationsForDay", () => {
  it("returns both accommodations on a transition day, with their roles", () => {
    const result = getAccommodationsForDay([sinaia, bran], "2026-08-25")

    expect(result).toEqual([
      { accommodation: sinaia, status: "check-out" },
      { accommodation: bran, status: "check-in" },
    ])
  })

  it("returns the arrival accommodation on its check-in day", () => {
    const result = getAccommodationsForDay([sinaia, bran], "2026-08-24")
    expect(result).toEqual([{ accommodation: sinaia, status: "check-in" }])
  })

  it("returns a mid-stay accommodation as staying", () => {
    const result = getAccommodationsForDay([sinaia, bran], "2026-08-27")
    expect(result).toEqual([{ accommodation: bran, status: "staying" }])
  })

  it("returns nothing for a day outside every stay", () => {
    expect(getAccommodationsForDay([sinaia, bran], "2026-09-15")).toEqual([])
  })

  it("skips an accommodation whose dates cannot be parsed", () => {
    // A Gemini extraction once wrote the literal template placeholder as the
    // year. Date matching is a string-prefix compare, so it silently matched
    // no day at all and the lodging vanished from every travel-time chip.
    const broken: Accommodation = { ...sinaia, checkIn: "YYYY-08-24T15:00", checkOut: "YYYY-08-25T12:00" }

    expect(getAccommodationsForDay([broken, bran], "2026-08-24")).toEqual([])
  })
})

describe("hasUnparseableDates", () => {
  it("is false when both dates are valid", () => {
    expect(hasUnparseableDates(sinaia)).toBe(false)
  })

  it("is false when an accommodation carries no dates at all", () => {
    // Absent dates are a normal, deliberate state — not a data error.
    expect(hasUnparseableDates({ name: "TBD" })).toBe(false)
  })

  it("is true for a placeholder year", () => {
    expect(hasUnparseableDates({ ...sinaia, checkIn: "YYYY-08-24T15:00" })).toBe(true)
  })

  it("is true for an outright malformed date", () => {
    expect(hasUnparseableDates({ ...sinaia, checkOut: "not-a-date" })).toBe(true)
  })

  it("is true when only one of the two is broken", () => {
    expect(hasUnparseableDates({ name: "X", checkIn: "2026-08-24T15:00", checkOut: "31/12/2026" })).toBe(true)
  })
})
