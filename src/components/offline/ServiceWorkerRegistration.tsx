"use client"

import { useEffect } from "react"

/**
 * Registers the offline service worker.
 *
 * Disabled in development by default: the caches fight Turbopack's HMR and make
 * every change look like it did not apply. Set NEXT_PUBLIC_ENABLE_SW=true to
 * exercise offline behaviour locally.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    const enabled =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_SW === "true"
    if (!enabled) return

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed:", error)
    })
  }, [])

  return null
}
