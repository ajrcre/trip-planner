"use client"

import { useEffect, useState } from "react"

import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { getLastSyncAt, SYNC_EVENT } from "@/lib/offline-sync"
import { queueSize, QUEUE_EVENT } from "@/lib/offline-queue"

function formatAge(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return "עודכן עכשיו"
  if (minutes < 60) return `עודכן לפני ${minutes} דקות`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `עודכן לפני ${hours} שעות`

  const days = Math.floor(hours / 24)
  return `עודכן לפני ${days} ימים`
}

/**
 * Tells the user they are looking at cached data and how old it is.
 *
 * The age matters more than the offline state itself: a schedule synced an hour
 * ago is trustworthy, one synced four days ago may not be, and the user is the
 * only one who can judge which.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const refresh = () => {
      setLastSync(getLastSyncAt())
      setPending(queueSize())
    }

    refresh()
    window.addEventListener(SYNC_EVENT, refresh)
    window.addEventListener(QUEUE_EVENT, refresh)
    // Keeps the relative age honest while the app sits open on a plane.
    const timer = setInterval(refresh, 60000)

    return () => {
      window.removeEventListener(SYNC_EVENT, refresh)
      window.removeEventListener(QUEUE_EVENT, refresh)
      clearInterval(timer)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      <span>אין חיבור לאינטרנט — מוצג המידע השמור</span>
      {lastSync && <span className="text-amber-900/80">{formatAge(lastSync)}</span>}
      {pending > 0 && (
        <span className="rounded-full bg-amber-950/15 px-2 py-0.5 text-xs">
          {pending} סימונים ממתינים לסנכרון
        </span>
      )}
    </div>
  )
}
