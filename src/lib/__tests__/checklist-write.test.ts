import { parseQuantity, resolveChecklistWrite } from "../checklist-write"

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

  describe("packing stages", () => {
    const staged = { stage: true }

    it("sets the stage and keeps checked in step with it", () => {
      const write = resolveChecklistWrite({ stage: 2 }, { checkedAt: null, stage: 1 }, NOW, staged)

      expect(write).toEqual({
        kind: "apply",
        data: { stage: 2, checked: true, checkedAt: NOW },
      })
    })

    it("clears checked when the stage goes back to 0", () => {
      const write = resolveChecklistWrite({ stage: 0 }, { checkedAt: null, stage: 3 }, NOW, staged)

      expect(write).toEqual({
        kind: "apply",
        data: { stage: 0, checked: false, checkedAt: NOW },
      })
    })

    it.each([4, -1, 1.5, "2", null])("ignores an invalid stage %p", (stage) => {
      const write = resolveChecklistWrite({ stage }, { checkedAt: null, stage: 1 }, NOW, staged)

      expect(write).toEqual({ kind: "apply", data: {} })
    })

    it("ignores a stage on a list without stages", () => {
      const write = resolveChecklistWrite({ stage: 2 }, { checkedAt: null }, NOW)

      expect(write).toEqual({ kind: "apply", data: {} })
    })

    it("guards a replayed stage change like a replayed toggle", () => {
      const tapped = new Date("2026-08-18T09:00:00.000Z")
      const write = resolveChecklistWrite(
        { stage: 3, ts: tapped.getTime() },
        { checkedAt: new Date("2026-08-18T15:00:00.000Z"), stage: 1 },
        NOW,
        staged
      )

      expect(write).toEqual({ kind: "conflict" })
    })

    it("maps a plain tick to 'have it' without undoing later stages", () => {
      expect(
        resolveChecklistWrite({ checked: true }, { checkedAt: null, stage: 0 }, NOW, staged)
      ).toEqual({ kind: "apply", data: { checked: true, stage: 1, checkedAt: NOW } })

      expect(
        resolveChecklistWrite({ checked: true }, { checkedAt: null, stage: 2 }, NOW, staged)
      ).toEqual({ kind: "apply", data: { checked: true, stage: 2, checkedAt: NOW } })
    })

    it("maps a plain untick to stage 0", () => {
      const write = resolveChecklistWrite({ checked: false }, { checkedAt: null, stage: 3 }, NOW, staged)

      expect(write).toEqual({
        kind: "apply",
        data: { checked: false, stage: 0, checkedAt: NOW },
      })
    })
  })

  describe("quantity", () => {
    const withQuantity = { quantity: true }

    it("sets a quantity without touching checkedAt", () => {
      const write = resolveChecklistWrite({ quantity: 3 }, { checkedAt: null }, NOW, withQuantity)

      expect(write).toEqual({ kind: "apply", data: { quantity: 3 } })
    })

    it("clears the quantity with null", () => {
      const write = resolveChecklistWrite({ quantity: null }, { checkedAt: null }, NOW, withQuantity)

      expect(write).toEqual({ kind: "apply", data: { quantity: null } })
    })

    it("ignores a quantity on a list without quantities", () => {
      const write = resolveChecklistWrite({ quantity: 3 }, { checkedAt: null }, NOW)

      expect(write).toEqual({ kind: "apply", data: {} })
    })
  })
})

describe("parseQuantity", () => {
  it.each([
    [1, 1],
    [12, 12],
    [null, null],
    [0, undefined],
    [-2, undefined],
    [1.5, undefined],
    ["3", undefined],
    [undefined, undefined],
  ])("parses %p as %p", (input, expected) => {
    expect(parseQuantity(input)).toBe(expected)
  })
})
