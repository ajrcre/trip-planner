import { readFileSync } from "fs"
import path from "path"
import vm from "vm"

/**
 * Runs the real public/sw.js against an in-memory Cache Storage and a scripted
 * network, dispatching fetch events the way the browser would.
 */

const ORIGIN = "https://app.test"
const SW_SOURCE = readFileSync(path.join(__dirname, "../../../public/sw.js"), "utf8")

type Listener = (event: unknown) => void

function cacheKey(key: string | Request): string {
  return typeof key === "string" ? new URL(key, ORIGIN).href : key.url
}

class FakeCache {
  entries = new Map<string, Response>()
  async match(key: string | Request) {
    return this.entries.get(cacheKey(key))?.clone()
  }
  async put(key: string | Request, response: Response) {
    this.entries.set(cacheKey(key), response)
  }
}

class FakeCacheStorage {
  stores = new Map<string, FakeCache>()
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache())
    return this.stores.get(name)!
  }
  async match(key: string | Request, options?: { cacheName?: string }) {
    const names = options?.cacheName ? [options.cacheName] : [...this.stores.keys()]
    for (const name of names) {
      const hit = await this.stores.get(name)?.match(key)
      if (hit) return hit
    }
    return undefined
  }
  async keys() {
    return [...this.stores.keys()]
  }
  async delete(name: string) {
    return this.stores.delete(name)
  }
}

/** A network whose GET answers can be changed between requests, or cut off. */
class FakeNetwork {
  bodies = new Map<string, string>()
  offline = false
  /** When set, GETs wait on this before answering, to hold a revalidation open. */
  gate: Promise<void> | null = null

  fetch = async (input: Request | string): Promise<Response> => {
    const request = typeof input === "string" ? new Request(new URL(input, ORIGIN)) : input
    if (this.offline) throw new TypeError("Failed to fetch")
    if (request.method !== "GET") return new Response("{}", { status: 200 })
    const body = this.bodies.get(new URL(request.url).pathname) ?? "null"
    if (this.gate) await this.gate
    return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })
  }
}

function loadWorker() {
  const listeners = new Map<string, Listener>()
  const network = new FakeNetwork()
  const caches = new FakeCacheStorage()
  let now = 1_000

  const context = vm.createContext({
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
      clients: { matchAll: async () => [], claim: async () => {} },
      skipWaiting: async () => {},
    },
    caches,
    fetch: network.fetch,
    Request,
    Response,
    Headers,
    URL,
    Date: Object.assign(
      class extends Date {},
      { now: () => now }
    ),
    console,
  })
  vm.runInContext(SW_SOURCE, context)

  /**
   * Dispatches a fetch event and resolves with what the page would receive:
   * the worker's answer, or the network's when the worker does not intercept.
   */
  async function request(pathname: string, init: RequestInit = {}) {
    const req = new Request(`${ORIGIN}${pathname}`, init)
    let answer: Promise<Response> | null = null
    const background: Promise<unknown>[] = []
    listeners.get("fetch")!({
      request: req,
      respondWith: (p: Promise<Response>) => (answer = p),
      waitUntil: (p: Promise<unknown>) => background.push(p),
    })
    const response = await (answer ?? network.fetch(req))
    return { response, background: Promise.all(background) }
  }

  async function getText(pathname: string) {
    const { response, background } = await request(pathname)
    return { text: await response.text(), background }
  }

  return {
    network,
    request,
    getText,
    tick: () => (now += 1_000),
  }
}

const LIST = "/api/trips/t1/packing"

describe("service worker API caching", () => {
  it("serves a cached read first and refreshes it in the background", async () => {
    const sw = loadWorker()
    sw.network.bodies.set(LIST, '["old"]')
    await (await sw.getText(LIST)).background
    sw.tick()

    sw.network.bodies.set(LIST, '["new"]')
    const second = await sw.getText(LIST)
    expect(second.text).toBe('["old"]')
    await second.background

    sw.tick()
    expect((await sw.getText(LIST)).text).toBe('["new"]')
  })

  it("shows the result of a save on the very next read", async () => {
    const sw = loadWorker()
    sw.network.bodies.set(LIST, '["old"]')
    await (await sw.getText(LIST)).background
    sw.tick()

    sw.network.bodies.set(LIST, '["old","added"]')
    const save = await sw.request(LIST, { method: "POST", body: "{}" })
    expect(save.response.ok).toBe(true)
    sw.tick()

    expect((await sw.getText(LIST)).text).toBe('["old","added"]')
  })

  it("does not let a refresh that started before a save count as fresh", async () => {
    const sw = loadWorker()
    sw.network.bodies.set(LIST, '["old"]')
    await (await sw.getText(LIST)).background
    sw.tick()

    // A background refresh is still waiting on the network when the save lands,
    // and then stores the pre-save list.
    let release!: () => void
    sw.network.gate = new Promise((resolve) => (release = resolve))
    const inFlight = await sw.getText(LIST)
    sw.tick()
    await sw.request(LIST, { method: "POST", body: "{}" })
    sw.network.bodies.set(LIST, '["old","added"]')
    sw.network.gate = null
    sw.tick()
    release()
    await inFlight.background
    sw.tick()

    expect((await sw.getText(LIST)).text).toBe('["old","added"]')
  })

  it("still falls back to the cached copy after a save when offline", async () => {
    const sw = loadWorker()
    sw.network.bodies.set(LIST, '["old"]')
    await (await sw.getText(LIST)).background
    sw.tick()

    await sw.request(LIST, { method: "POST", body: "{}" })
    sw.tick()
    sw.network.offline = true

    expect((await sw.getText(LIST)).text).toBe('["old"]')
  })

  it("keeps serving cached reads first once the post-save read has refreshed them", async () => {
    const sw = loadWorker()
    sw.network.bodies.set(LIST, '["old"]')
    await (await sw.getText(LIST)).background
    sw.tick()
    await sw.request(LIST, { method: "POST", body: "{}" })
    sw.tick()
    sw.network.bodies.set(LIST, '["saved"]')
    await (await sw.getText(LIST)).background
    sw.tick()

    sw.network.bodies.set(LIST, '["someone else"]')
    expect((await sw.getText(LIST)).text).toBe('["saved"]')
  })
})
