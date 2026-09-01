"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import { resolveEntryTrip, type TripDates } from "@/lib/active-trip"
import { readLastPath, stripPinnedDay } from "@/lib/last-path"

/** Set once per browsing session so re-entering /open cannot loop or override. */
const OPENED_KEY = "tp:opened"

function alreadyOpened(): boolean {
  try {
    return window.sessionStorage.getItem(OPENED_KEY) === "1"
  } catch {
    return false
  }
}

function markOpened(): void {
  try {
    window.sessionStorage.setItem(OPENED_KEY, "1")
  } catch {
    // Private mode. Worst case the dispatcher resolves again, which is harmless.
  }
}

async function resolveDestination(): Promise<string> {
  const last = readLastPath()
  if (last) return stripPinnedDay(last)

  let trips: TripDates[]
  try {
    const res = await fetch("/api/trips")
    if (!res.ok) return "/trips"
    trips = await res.json()
  } catch {
    return "/trips"
  }
  if (!Array.isArray(trips)) return "/trips"

  const entry = resolveEntryTrip(trips)
  if (!entry) return "/trips"
  // Mid-trip the schedule is the screen being used all day; before departure the
  // overview is still the one being edited.
  return entry.phase === "in-progress"
    ? `/trips/${entry.trip.id}?tab=schedule`
    : `/trips/${entry.trip.id}`
}

/**
 * The app's entry point (the manifest's `start_url`).
 *
 * Resolves where a launch should land — the last place the user was, or failing
 * that the trip they are currently on — and redirects. It holds nothing itself,
 * so it is replaced in the history stack rather than pushed.
 */
export default function OpenPage() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return

    if (status === "unauthenticated") {
      router.replace("/")
      return
    }

    // Navigating back to /open within the same session means the user came from
    // somewhere in the app; resolving again would bounce them around.
    if (alreadyOpened()) {
      router.replace("/trips")
      return
    }
    markOpened()

    let cancelled = false
    resolveDestination().then((dest) => {
      if (!cancelled) router.replace(dest)
    })
    return () => {
      cancelled = true
    }
  }, [status, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  )
}
