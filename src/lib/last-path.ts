/**
 * Remembers where the user was so relaunching the app puts them back there.
 *
 * An installed PWA cold-starts at the manifest's `start_url` every time iOS
 * evicts it, which during a trip means losing your place several times a day —
 * you check a shared shopping list, switch apps, come back, and you are on the
 * home screen again. The path is stored rather than restored from history
 * because a cold start has no history to go back to.
 */

const LAST_PATH_KEY = "tp:lastPath"

/**
 * Paths that are pointless or actively wrong to resume into: the marketing
 * landing page, the dispatcher itself (which would loop), auth screens, and the
 * new-trip form (resuming into a half-filled form the user abandoned).
 */
const EXCLUDED = [/^\/$/, /^\/open/, /^\/auth\//, /^\/api\//, /^\/trips\/new/]

export function isResumablePath(path: string): boolean {
  if (!path.startsWith("/")) return false
  if (path.startsWith("//")) return false // protocol-relative URL, not an in-app path
  return !EXCLUDED.some((re) => re.test(path))
}

export function rememberPath(path: string): void {
  if (!isResumablePath(path)) return
  try {
    window.localStorage.setItem(LAST_PATH_KEY, path)
  } catch {
    // Private mode / quota. Resume degrades to the default entry point.
  }
}

export function readLastPath(): string | null {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(LAST_PATH_KEY)
  } catch {
    return null
  }
  if (!raw || !isResumablePath(raw)) return null
  return raw
}

export function forgetPath(): void {
  try {
    window.localStorage.removeItem(LAST_PATH_KEY)
  } catch {
    // Nothing to clean up.
  }
}

/**
 * The stored path wins for *where* the user was, but not for *which day* of the
 * schedule: on a trip in progress "today" is almost always what they want, so a
 * remembered `?day=` is dropped and the schedule re-picks today.
 */
export function stripPinnedDay(path: string): string {
  const url = new URL(path, "http://local")
  url.searchParams.delete("day")
  const query = url.searchParams.toString()
  return query ? `${url.pathname}?${query}` : url.pathname
}
