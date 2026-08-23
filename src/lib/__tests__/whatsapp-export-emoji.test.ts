import { formatDayForWhatsApp } from "../format-whatsapp"
import type { DayPlanData } from "@/components/schedule/DayTimeline"

/**
 * WhatsApp messages are plain text on the clipboard — a React component cannot
 * go into one. This guards the emoji half of the dual representation in
 * schedule-display's typeConfig against being "cleaned up" into icons.
 */
const day = {
  id: "d1",
  date: "2026-08-25",
  dayType: "full_day",
  notes: null,
  activities: [
    {
      id: "a1",
      type: "attraction",
      timeStart: "10:00",
      timeEnd: "11:30",
      notes: null,
      attraction: {
        id: "p1",
        name: "Zoo Brașov",
        address: "Brașov",
        phone: "+40 1234",
        website: null,
        googlePlaceId: "abc",
        openingHours: null,
        lat: 1,
        lng: 2,
      },
      restaurant: null,
      groceryStore: null,
      alternatives: [],
    },
    {
      id: "a2",
      type: "meal",
      timeStart: "13:00",
      timeEnd: "14:00",
      notes: null,
      attraction: null,
      restaurant: null,
      groceryStore: null,
      alternatives: [],
    },
  ],
} as unknown as DayPlanData

describe("WhatsApp export", () => {
  const text = formatDayForWhatsApp(day, [])

  it("still emits emoji, not icon components", () => {
    expect(text).toContain("🏛️") // attraction
    expect(text).toContain("🍽️") // meal
    expect(text).toContain("☀️") // full_day header
  })

  it("keeps the plain-text detail markers", () => {
    expect(text).toContain("📍")
    expect(text).toContain("📞")
  })

  it("never leaks an object into the message", () => {
    expect(text).not.toContain("[object Object]")
    expect(text).not.toContain("undefined")
  })
})
