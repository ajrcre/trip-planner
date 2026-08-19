import { resolveChecklistWrite } from "../checklist-write"

const NOW = new Date("2026-08-18T12:00:00.000Z")

describe("resolveChecklistWrite", () => {
  describe("live online toggles (no ts)", () => {
    it("applies unconditionally and stamps checkedAt", () => {
      const write = resolveChecklistWrite(
        { checked: true },
        { checkedAt: new Date("2026-08-18T11:00:00.000Z") },
        NOW
      )

      expect(write).toEqual({ kind: "apply", data: { checked: true, checkedAt: NOW } })
    })

    it("still applies when the server value is newer than any client clock", () => {
      const future = new Date("2030-01-01T00:00:00.000Z")
      const write = resolveChecklistWrite({ checked: false }, { checkedAt: future }, NOW)

      expect(write.kind).toBe("apply")
    })
  })

  describe("replayed offline toggles (with ts)", () => {
    it("applies when the tap is newer than the last recorded change", () => {
      const tapped = new Date("2026-08-18T11:30:00.000Z")
      const write = resolveChecklistWrite(
        { checked: true, ts: tapped.getTime() },
        { checkedAt: new Date("2026-08-18T10:00:00.000Z") },
        NOW
      )

      expect(write).toEqual({
        kind: "apply",
        data: { checked: true, checkedAt: tapped },
      })
    })

    it("conflicts when someone changed the box after the tap", () => {
      // The case worth guarding: a tick made on a plane at 09:00 must not
      // overwrite a change someone else made at 15:00.
      const tapped = new Date("2026-08-18T09:00:00.000Z")
      const write = resolveChecklistWrite(
        { checked: true, ts: tapped.getTime() },
        { checkedAt: new Date("2026-08-18T15:00:00.000Z") },
        NOW
      )

      expect(write).toEqual({ kind: "conflict" })
    })

    it("conflicts on an exact tie so the server value wins", () => {
      const same = new Date("2026-08-18T09:00:00.000Z")
      const write = resolveChecklistWrite(
        { checked: true, ts: same.getTime() },
        { checkedAt: same },
        NOW
      )

      expect(write).toEqual({ kind: "conflict" })
    })

    it("applies when the row has never recorded a checkbox change", () => {
      // Rows that predate the checkedAt column, which the migration leaves null.
      const tapped = new Date("2026-08-18T09:00:00.000Z")
      const write = resolveChecklistWrite(
        { checked: false, ts: tapped.getTime() },
        { checkedAt: null },
        NOW
      )

      expect(write).toEqual({
        kind: "apply",
        data: { checked: false, checkedAt: tapped },
      })
    })

    it("ignores a non-numeric ts rather than trusting it", () => {
      const write = resolveChecklistWrite(
        { checked: true, ts: "not-a-number" },
        { checkedAt: new Date("2026-08-18T15:00:00.000Z") },
        NOW
      )

      expect(write).toEqual({ kind: "apply", data: { checked: true, checkedAt: NOW } })
    })
  })

  describe("renames", () => {
    it("does not touch checkedAt, so an in-flight tick is not blocked by an edit", () => {
      const write = resolveChecklistWrite({ item: "מטריה" }, { checkedAt: null }, NOW)

      expect(write).toEqual({ kind: "apply", data: { item: "מטריה" } })
    })

    it("applies a rename and a toggle together", () => {
      const write = resolveChecklistWrite(
        { item: "מטריה", checked: true },
        { checkedAt: null },
        NOW
      )

      expect(write).toEqual({
        kind: "apply",
        data: { item: "מטריה", checked: true, checkedAt: NOW },
      })
    })
  })

  it("ignores fields of the wrong type", () => {
    const write = resolveChecklistWrite(
      { checked: "yes", item: 42 },
      { checkedAt: null },
      NOW
    )

    expect(write).toEqual({ kind: "apply", data: {} })
  })
})
