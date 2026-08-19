"use client"

import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange)
  window.addEventListener("offline", onChange)
  return () => {
    window.removeEventListener("online", onChange)
    window.removeEventListener("offline", onChange)
  }
}

const getSnapshot = () => navigator.onLine

/**
 * The server has no connectivity to report, and an optimistic `true` matches
 * what the client assumes before its first paint — so hydration agrees.
 */
const getServerSnapshot = () => true

/**
 * Tracks connectivity for the offline-aware UI: which edit controls are
 * disabled, whether maps render or show a placeholder, and when queued
 * checklist toggles replay.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
