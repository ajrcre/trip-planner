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
