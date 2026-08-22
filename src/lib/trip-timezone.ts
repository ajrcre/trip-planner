/**
 * Offset in milliseconds between the given instant and how a wall clock in
 * `timeZone` reads it. Positive east of UTC.
 */
function offsetAt(ms: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = dtf.formatToParts(new Date(ms))
  const get = (type: string) => {
    const part = parts.find((p) => p.type === type)
    if (!part) throw new Error(`Missing ${type} in formatted date`)
    return Number(part.value)
  }
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    // Some ICU versions emit hour "24" for midnight under hour12: false.
    get("hour") % 24,
    get("minute"),
    get("second")
  )
  return asUtc - ms
}

/**
 * Interpret `dateStr` ("YYYY-MM-DD") and `timeStr` ("HH:mm") as a wall-clock
 * time in `timeZone`, and return the corresponding UTC instant.
 *
 * Two passes: the first estimates the offset at the naive instant, the second
 * re-measures at the corrected instant so DST transitions land correctly.
 */
export function zonedDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date {
  const naiveMs = Date.parse(`${dateStr}T${timeStr}:00Z`)
  if (Number.isNaN(naiveMs)) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`)
  }
  const firstPass = naiveMs - offsetAt(naiveMs, timeZone)
  const secondPass = naiveMs - offsetAt(firstPass, timeZone)
  return new Date(secondPass)
}

// Timezone ids never change for a location, so entries never expire.
// Keyed on coordinates rounded to 1 decimal place (~11 km), which keeps a
// whole city on one entry.
const timeZoneCache = new Map<string, string | null>()

function tzCacheKey(coords: { lat: number; lng: number }): string {
  return `${coords.lat.toFixed(1)},${coords.lng.toFixed(1)}`
}

/** @internal — exported for testing only */
export function clearTimeZoneCache() {
  timeZoneCache.clear()
}

/**
 * Resolve the IANA timezone id for a coordinate via the Google Time Zone API.
 * Returns null on any failure; callers fall back to omitting the departure
 * time, which reproduces the previous live-traffic behaviour.
 */
export async function resolveTimeZone(coords: {
  lat: number
  lng: number
}): Promise<string | null> {
  const key = tzCacheKey(coords)
  const cached = timeZoneCache.get(key)
  if (cached !== undefined) return cached

  let result: string | null = null
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured")

    const url = new URL("https://maps.googleapis.com/maps/api/timezone/json")
    url.searchParams.set("location", `${coords.lat},${coords.lng}`)
    url.searchParams.set(
      "timestamp",
      String(Math.floor(Date.now() / 1000))
    )
    url.searchParams.set("key", apiKey)

    const response = await fetch(url.toString())
    if (response.ok) {
      const data = await response.json()
      if (data?.status === "OK" && typeof data.timeZoneId === "string") {
        result = data.timeZoneId
      }
    }
  } catch {
    result = null
  }

  timeZoneCache.set(key, result)
  return result
}

/**
 * Build the UTC instant at which a traveller departs `originCoords` for an
 * activity starting at `timeStart` (local wall clock) on `dayDate`.
 *
 * Returns undefined when there is no start time or the timezone is unknown,
 * in which case callers omit departureTime entirely.
 */
export async function departureInstant(
  dayDate: Date,
  timeStart: string | null,
  originCoords: { lat: number; lng: number }
): Promise<Date | undefined> {
  if (!timeStart) return undefined

  const timeZone = await resolveTimeZone(originCoords)
  if (!timeZone) return undefined

  // dayDate is a date-only column; read its calendar date in UTC to avoid a
  // server-local shift moving the trip a day.
  const dateStr = dayDate.toISOString().split("T")[0]

  try {
    return zonedDateTimeToUtc(dateStr, timeStart, timeZone)
  } catch {
    return undefined
  }
}
