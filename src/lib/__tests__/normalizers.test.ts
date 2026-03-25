import { normalizeFlights, normalizeCarRentals } from "../normalizers"

describe("normalizeFlights", () => {
  it("returns empty array for null", () => {
    expect(normalizeFlights(null)).toEqual([])
  })
  it("returns empty array for undefined", () => {
    expect(normalizeFlights(undefined)).toEqual([])
  })
  it("passes through a valid array", () => {
    const flights = [
      { flightNumber: "LY001", departureAirport: "TLV", arrivalAirport: "JFK" },
    ]
    expect(normalizeFlights(flights)).toEqual(flights)
  })
  it("converts old {outbound, return} format to array", () => {
    const old = {
      outbound: { flightNumber: "LY001", departureAirport: "TLV", arrivalAirport: "JFK", departureTime: "2026-04-15T08:00", arrivalTime: "2026-04-15T14:00" },
      return: { flightNumber: "LY002", departureAirport: "JFK", arrivalAirport: "TLV", departureTime: "2026-04-22T18:00", arrivalTime: "2026-04-23T10:00" },
    }
    expect(normalizeFlights(old)).toEqual([old.outbound, old.return])
  })
  it("filters out empty legs from old format", () => {
    const old = {
      outbound: { flightNumber: "LY001", departureAirport: "TLV" },
      return: { flightNumber: "", departureAirport: "", departureTime: "", arrivalAirport: "", arrivalTime: "" },
    }
    expect(normalizeFlights(old)).toEqual([{ flightNumber: "LY001", departureAirport: "TLV" }])
  })
  it("handles old format with only outbound", () => {
    const old = { outbound: { flightNumber: "LY001" }, return: null }
    expect(normalizeFlights(old)).toEqual([{ flightNumber: "LY001" }])
  })
  it("handles old format with null outbound and return", () => {
    const old = { outbound: null, return: null }
    expect(normalizeFlights(old)).toEqual([])
  })
})

describe("normalizeCarRentals", () => {
  it("returns empty array for null", () => {
    expect(normalizeCarRentals(null)).toEqual([])
  })
  it("returns empty array for undefined", () => {
    expect(normalizeCarRentals(undefined)).toEqual([])
  })
  it("passes through a valid array", () => {
    const rentals = [{ company: "Hertz", pickupLocation: "JFK" }]
    expect(normalizeCarRentals(rentals)).toEqual(rentals)
  })
  it("wraps single object in array", () => {
    const single = { company: "Hertz", pickupLocation: "JFK", returnLocation: "JFK" }
    expect(normalizeCarRentals(single)).toEqual([single])
  })
  it("returns empty array for empty object", () => {
    expect(normalizeCarRentals({})).toEqual([])
  })
  it("returns empty array for object with all empty strings", () => {
    expect(normalizeCarRentals({ company: "", pickupLocation: "" })).toEqual([])
  })
})
