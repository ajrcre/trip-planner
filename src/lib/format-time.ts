const LOCALE = "he-IL"

/** Date + time for flights, check-in, exports, etc. — always 24-hour clock */
export function formatUiDateTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input
  return d.toLocaleString(LOCALE, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** Same as formatUiDateTime but with long month name (e.g. footer timestamps) */
export function formatUiDateTimeLong(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input
  return d.toLocaleString(LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}
