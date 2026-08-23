import { formatMinutes } from "../format-duration"

describe("formatMinutes", () => {
  it("returns an empty string for non-positive input", () => {
    expect(formatMinutes(0)).toBe("")
    expect(formatMinutes(-5)).toBe("")
  })

  it("formats sub-hour durations in minutes", () => {
    expect(formatMinutes(1)).toBe("דקה")
    expect(formatMinutes(7)).toBe("7 דק׳")
    expect(formatMinutes(47)).toBe("47 דק׳")
    expect(formatMinutes(59)).toBe("59 דק׳")
  })

  it("uses idiomatic fractions under an hour", () => {
    expect(formatMinutes(15)).toBe("רבע שעה")
    expect(formatMinutes(30)).toBe("חצי שעה")
  })

  it("uses the singular and dual forms without a numeral", () => {
    expect(formatMinutes(60)).toBe("שעה")
    expect(formatMinutes(120)).toBe("שעתיים")
  })

  it("uses idiomatic fractions for one and two hours", () => {
    expect(formatMinutes(75)).toBe("שעה ורבע")
    expect(formatMinutes(90)).toBe("שעה וחצי")
    expect(formatMinutes(105)).toBe("שעה ושלושת רבעי")
    expect(formatMinutes(150)).toBe("שעתיים וחצי")
  })

  it("avoids a leading numeral for one and two hours", () => {
    // "שעה ו-18 דק׳" rather than "1 שע׳ 18 דק׳": idiomatic, and it removes
    // one of the two numerals that make the RTL string bidi-fragile.
    expect(formatMinutes(78)).toBe("שעה ו-18 דק׳")
    expect(formatMinutes(125)).toBe("שעתיים ו-5 דק׳")
  })

  it("formats three or more hours with a numeral", () => {
    expect(formatMinutes(180)).toBe("3 שעות")
    expect(formatMinutes(195)).toBe("3 שעות ורבע")
    expect(formatMinutes(210)).toBe("3 שעות וחצי")
    expect(formatMinutes(225)).toBe("3 שעות ושלושת רבעי")
    expect(formatMinutes(198)).toBe("3 שעות ו-18 דק׳")
  })

  it("never places two numerals adjacent to each other", () => {
    // Two numerals separated only by neutral characters can be reordered by
    // the bidi algorithm. Every output must keep Hebrew letters between them.
    for (let m = 1; m <= 600; m++) {
      const s = formatMinutes(m)
      expect(s).not.toMatch(/\d[\s‐-―-]*\d+\s*$/)
      expect(s).not.toMatch(/^\s*\d+[\s‐-―-]+\d/)
    }
  })

  it("rounds fractional minutes to whole minutes", () => {
    expect(formatMinutes(46.4)).toBe("46 דק׳")
    expect(formatMinutes(46.6)).toBe("47 דק׳")
  })
})
