import {
  icons,
  activityTypeIcons,
  dayTypeIcons,
  actionTypeIcons,
  attractionTypeIcons,
  weatherIcons,
  fallbackActivityIcon,
  attractionIcon,
} from "../icons"
import { typeConfig, dayTypeConfig, activityDisplay } from "../schedule-display"
import { weatherIcon } from "../weather"

/**
 * A missing icon does not fail typechecking — a `Record<string, LucideIcon>`
 * lookup is typed as defined even when the key is absent — but it crashes React
 * at render with "Element type is invalid". These assert the maps are complete.
 */
function expectAllDefined(map: Record<string, unknown>, name: string) {
  const missing = Object.entries(map)
    .filter(([, v]) => typeof v !== "function" && typeof v !== "object")
    .map(([k]) => k)
  expect(`${name}: ${missing.join(", ")}`).toBe(`${name}: `)
}

describe("icon registry", () => {
  it.each([
    ["icons", icons],
    ["activityTypeIcons", activityTypeIcons],
    ["dayTypeIcons", dayTypeIcons],
    ["actionTypeIcons", actionTypeIcons],
    ["attractionTypeIcons", attractionTypeIcons],
    ["weatherIcons", weatherIcons],
  ])("resolves every entry in %s", (name, map) => {
    expectAllDefined(map as Record<string, unknown>, name)
  })

  it("has a renderable fallback", () => {
    expect(fallbackActivityIcon).toBeTruthy()
    expect(attractionIcon(null)).toBeTruthy()
    expect(attractionIcon("not_a_real_type")).toBeTruthy()
  })
})

describe("schedule display configs", () => {
  it("gives every activity type a renderable icon", () => {
    for (const [type, config] of Object.entries(typeConfig)) {
      expect(`${type}:${typeof config.Icon}`).toBe(`${type}:object`)
      expect(config.icon).toBeTruthy() // emoji, for the text exports
    }
  })

  it("gives every day type a renderable icon", () => {
    for (const [type, config] of Object.entries(dayTypeConfig)) {
      expect(`${type}:${typeof config.Icon}`).toBe(`${type}:object`)
    }
  })

  it("resolves an icon for an unknown activity type", () => {
    const d = activityDisplay({ type: "something_new", timeStart: null })
    expect(d.Icon).toBeTruthy()
  })

  it("varies the attraction icon by place type", () => {
    const museum = activityDisplay({ type: "attraction", timeStart: null }, { attractionType: "museum" })
    const zoo = activityDisplay({ type: "attraction", timeStart: null }, { attractionType: "zoo" })
    expect(museum.Icon).not.toBe(zoo.Icon)
  })
})

describe("weatherIcon", () => {
  it("resolves every WMO code the API can return", () => {
    for (let code = 0; code <= 99; code++) {
      expect(`${code}:${typeof weatherIcon(code)}`).toBe(`${code}:object`)
    }
  })
})
