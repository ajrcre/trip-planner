"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"

import { syncOfflineCaches } from "@/lib/offline-sync"

/**
 * Keeps the offline caches current: refreshes on load and whenever the device
 * regains a connection, so the last sync is never older than the last time the
 * user had signal.
 */
export function OfflineWarmup() {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  useEffect(() => {
    if (status !== "authenticated") return

    const run = () => void syncOfflineCaches(userId)
    const sw = navigator.serviceWorker

    run()

    // On a first visit the worker has not claimed the page yet, so the warm-up
    // above no-ops. `controllerchange` is the moment it takes over and the first
    // real warm-up becomes possible.
    sw?.addEventListener("controllerchange", run)
    window.addEventListener("online", run)

    return () => {
      sw?.removeEventListener("controllerchange", run)
      window.removeEventListener("online", run)
    }
  }, [status, userId])

  return null
}
