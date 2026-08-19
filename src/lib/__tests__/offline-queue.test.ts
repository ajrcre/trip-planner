/**
 * Jest runs in the "node" environment here, so the browser globals the queue
 * touches are stubbed rather than pulling in jsdom.
 */

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value))
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
}

const storage = new MemoryStorage()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).window = { localStorage: storage, dispatchEvent: jest.fn() }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).CustomEvent = class {
  constructor(public type: string) {}
}

import {
  applyPendingToggles,
  clearQueue,
  enqueueToggle,
  queueSize,
  readQueue,
  replayQueue,
} from "../offline-queue"

const base = { tripId: "trip1", apiPath: "packing" }

function res(status: number) {
  return { ok: status >= 200 && status < 300, status }
}

beforeEach(() => {
  clearQueue()
  jest.restoreAllMocks()
})

describe("enqueueToggle", () => {
  it("keeps one entry per item, retaining the latest state and tap time", () => {
    enqueueToggle({ ...base, itemId: "a", checked: true, ts: 1000 })
    enqueueToggle({ ...base, itemId: "a", checked: false, ts: 2000 })

    expect(readQueue()).toEqual([
      { ...base, itemId: "a", checked: false, ts: 2000 },
    ])
  })

  it("keeps items in different lists apart", () => {
    enqueueToggle({ ...base, itemId: "a", checked: true, ts: 1000 })
    enqueueToggle({ ...base, apiPath: "todos", itemId: "a", checked: false, ts: 1000 })

    expect(queueSize()).toBe(2)
  })
})

describe("applyPendingToggles", () => {
  it("overlays queued state on a stale cached response", () => {
    // The reason this exists: offline the API response comes from the service
    // worker cache and still holds the pre-tap values.
    enqueueToggle({ ...base, itemId: "a", checked: true, ts: 1000 })

    const items = [
      { id: "a", checked: false },
      { id: "b", checked: false },
    ]

    expect(applyPendingToggles("packing", items)).toEqual([
      { id: "a", checked: true },
      { id: "b", checked: false },
    ])
  })

  it("does not leak toggles across lists", () => {
    enqueueToggle({ ...base, apiPath: "todos", itemId: "a", checked: true, ts: 1000 })

    const items = [{ id: "a", checked: false }]
    expect(applyPendingToggles("packing", items)).toEqual(items)
  })

  it("returns the input untouched when nothing is queued", () => {
    const items = [{ id: "a", checked: false }]
    expect(applyPendingToggles("packing", items)).toBe(items)
  })
})

describe("replayQueue", () => {
  it("sends the tap time so the server can reject a stale write", async () => {
    const fetchMock = jest.fn().mockResolvedValue(res(200))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).fetch = fetchMock

    enqueueToggle({ ...base, itemId: "a", checked: true, ts: 1234 })
    await replayQueue()

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trips/trip1/packing?itemId=a",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ checked: true, ts: 1234 }),
      })
    )
  })

  it("drops entries the server accepted", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).fetch = jest.fn().mockResolvedValue(res(200))

    enqueueToggle({ ...base, itemId: "a", checked: true, ts: 1000 })
    const result = await replayQueue()

    expect(result.applied).toBe(1)
    expect(queueSize()).toBe(0)
  })

  it("counts a 409 as a conflict and drops it", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).fetch = jest.fn().mockResolvedValue(res(409))

    enqueueToggle({ ...base, itemId: "a", checked: true, ts: 1000 })
    const result = await replayQueue()

    expect(result).toMatchObject({ applied: 0, conflicts: 1, forbidden: false })
    expect(queueSize()).toBe(0)
  })

  it("counts a 404 as a conflict — the item was deleted while offline", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).fetch = jest.fn().mockResolvedValue(res(404))

    enqueueToggle({ ...base, itemId: "a", checked: true, ts: 1000 })
    const result = await replayQueue()

    expect(result.conflicts).toBe(1)
    expect(queueSize()).toBe(0)
  })

  it("flags a 403 separately so the UI can explain the lost access", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).fetch = jest.fn().mockResolvedValue(res(403))

    enqueueToggle({ ...base, itemId: "a", checked: true, ts: 1000 })
    const result = await replayQueue()

    expect(result.forbidden).toBe(true)
    expect(result.conflicts).toBe(0)
  })

  it("keeps entries whose replay hit the network, so nothing is lost", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).fetch = jest.fn().mockRejectedValue(new Error("offline"))

    enqueueToggle({ ...base, itemId: "a", checked: true, ts: 1000 })
    const result = await replayQueue()

    expect(result).toMatchObject({ applied: 0, pending: 1 })
    expect(queueSize()).toBe(1)
  })

  it("retains only the failed entries when a replay is partly successful", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(res(200))
      .mockRejectedValueOnce(new Error("offline"))

    enqueueToggle({ ...base, itemId: "a", checked: true, ts: 1000 })
    enqueueToggle({ ...base, itemId: "b", checked: true, ts: 1001 })
    await replayQueue()

    expect(readQueue()).toEqual([{ ...base, itemId: "b", checked: true, ts: 1001 }])
  })

  it("no-ops on an empty queue without touching the network", async () => {
    const fetchMock = jest.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(global as any).fetch = fetchMock

    const result = await replayQueue()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toEqual({ applied: 0, conflicts: 0, forbidden: false, pending: 0 })
  })
})
