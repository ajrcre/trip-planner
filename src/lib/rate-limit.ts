const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS = 20

const requests = new Map<string, number[]>()

// Clean up old entries every 5 minutes
let lastCleanup = Date.now()
function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < 5 * 60 * 1000) return
  lastCleanup = now
  const cutoff = now - WINDOW_MS
  for (const [key, timestamps] of requests) {
    const filtered = timestamps.filter((t) => t > cutoff)
    if (filtered.length === 0) {
      requests.delete(key)
    } else {
      requests.set(key, filtered)
    }
  }
}

export function checkRateLimit(key: string): { allowed: boolean } {
  cleanup()
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const timestamps = (requests.get(key) ?? []).filter((t) => t > cutoff)
  if (timestamps.length >= MAX_REQUESTS) {
    return { allowed: false }
  }
  timestamps.push(now)
  requests.set(key, timestamps)
  return { allowed: true }
}
