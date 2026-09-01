"use client"

import { useEffect, useState } from "react"

/**
 * How long the chip lingers after the last cached response was served. Long
 * enough to be readable, short enough that it is gone before the fresh data
 * lands.
 */
const LINGER_MS = 1500

/**
 * Says "refreshing" while the app is showing cached data.
 *
 * The service worker answers from cache first now, so a screen can be a few
 * seconds out of date without anything on it looking different. That is fine
 * for a schedule and misleading for a shared shopping list someone else is
 * ticking off, so the app admits it rather than looking silently stale.
 */
export function RevalidatingIndicator() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return

    let timer: ReturnType<typeof setTimeout> | undefined

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "REVALIDATING") return
      setVisible(true)
      clearTimeout(timer)
      timer = setTimeout(() => setVisible(false), LINGER_MS)
    }

    sw.addEventListener("message", onMessage)
    return () => {
      sw.removeEventListener("message", onMessage)
      clearTimeout(timer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-zinc-100/90 dark:text-zinc-900"
    >
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      מתעדכן…
    </div>
  )
}
