import {
  mapAttractionType,
  attractionTypeLabel,
  attractionTypeMap,
} from "../attraction-types"
import { attractionTypeIcons } from "../icons"

describe("mapAttractionType", () => {
  it("returns the Google type key, not the Hebrew label", () => {
    expect(mapAttractionType(["museum"])).toBe("museum")
  })

  it("prefers the specific type over the generic tourist_attraction", () => {
    // Google returns types roughly specific-first, but the generic catch-all can
    // lead. Either order must resolve to the museum.
    expect(mapAttractionType(["museum", "tourist_attraction"])).toBe("museum")
    expect(mapAttractionType(["tourist_attraction", "museum"])).toBe("museum")
  })

  it("ignores types it does not recognise", () => {
    expect(mapAttractionType(["point_of_interest", "establishment"])).toBeNull()
  })

  it("returns null for an empty list", () => {
    expect(mapAttractionType([])).toBeNull()
  })

  it("maps the distinct categories the icons depend on", () => {
    expect(mapAttractionType(["zoo"])).toBe("zoo")
    expect(mapAttractionType(["aquarium"])).toBe("aquarium")
    expect(mapAttractionType(["beach"])).toBe("beach")
    expect(mapAttractionType(["national_park"])).toBe("national_park")
  })
})

describe("attractionTypeLabel", () => {
  it("resolves a stored key to its Hebrew label", () => {
    expect(attractionTypeLabel("museum")).toBe("מוזיאון")
    expect(attractionTypeLabel("zoo")).toBe("גן חיות")
  })

  it("returns null for missing or unknown values", () => {
    expect(attractionTypeLabel(null)).toBeNull()
    expect(attractionTypeLabel(undefined)).toBeNull()
    expect(attractionTypeLabel("not_a_real_type")).toBeNull()
  })
})

describe("icon coverage", () => {
  it("gives every mapped attraction type an icon", () => {
    // The two maps are keyed by the same Google type strings. A key present in
    // one but not the other means an attraction silently falls back to the
    // generic landmark despite having a recognised type.
    const missing = Object.keys(attractionTypeMap).filter(
      (type) => !attractionTypeIcons[type]
    )
    expect(missing).toEqual([])
  })

  it("has no icon entries for types the mapper never returns", () => {
    const orphaned = Object.keys(attractionTypeIcons).filter(
      (type) => !attractionTypeMap[type]
    )
    expect(orphaned).toEqual([])
  })
})
