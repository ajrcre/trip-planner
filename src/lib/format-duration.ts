/**
 * Hebrew duration formatting.
 *
 * Two constraints shape the output beyond plain readability:
 *
 * 1. Hebrew has singular, dual and plural hour forms — שעה / שעתיים / שעות —
 *    and the first two read wrong with a numeral in front ("1 שעה").
 * 2. The UI is RTL. A string holding two numerals separated only by neutral
 *    characters can be visually reordered by the bidi algorithm, so an
 *    "1 שע׳ 18 דק׳" can render with its numbers transposed. Keeping Hebrew
 *    letters between every pair of numerals — and dropping the leading
 *    numeral entirely for one and two hours — avoids the ambiguity rather
 *    than relying on markup to contain it.
 */

/** Format a whole-minute duration as an idiomatic Hebrew phrase. */
export function formatMinutes(totalMinutes: number): string {
  const total = Math.round(totalMinutes)
  if (!Number.isFinite(total) || total <= 0) return ""

  const hours = Math.floor(total / 60)
  const mins = total % 60

  if (hours === 0) {
    if (mins === 1) return "דקה"
    if (mins === 15) return "רבע שעה"
    if (mins === 30) return "חצי שעה"
    return `${mins} דק׳`
  }

  // One and two hours take the singular/dual noun, never a numeral.
  if (hours === 1) {
    if (mins === 0) return "שעה"
    if (mins === 15) return "שעה ורבע"
    if (mins === 30) return "שעה וחצי"
    if (mins === 45) return "שעה ושלושת רבעי"
    return `שעה ו-${mins} דק׳`
  }

  if (hours === 2) {
    if (mins === 0) return "שעתיים"
    if (mins === 15) return "שעתיים ורבע"
    if (mins === 30) return "שעתיים וחצי"
    if (mins === 45) return "שעתיים ושלושת רבעי"
    return `שעתיים ו-${mins} דק׳`
  }

  if (mins === 0) return `${hours} שעות`
  if (mins === 15) return `${hours} שעות ורבע`
  if (mins === 30) return `${hours} שעות וחצי`
  if (mins === 45) return `${hours} שעות ושלושת רבעי`
  return `${hours} שעות ו-${mins} דק׳`
}

/**
 * Format the gap between two "HH:mm" wall-clock times.
 * Returns an empty string when the range is empty or inverted.
 */
export function formatTimeRange(timeStart: string, timeEnd: string): string {
  const [sh, sm] = timeStart.split(":").map(Number)
  const [eh, em] = timeEnd.split(":").map(Number)
  if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) return ""
  return formatMinutes(eh * 60 + em - (sh * 60 + sm))
}
