"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { TripListItem } from "@/types/sharing"

export default function TripsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [trips, setTrips] = useState<TripListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
      return
    }
    if (status === "authenticated") {
      fetch("/api/trips")
        .then((res) => res.json())
        .then((data) => setTrips(data))
        .finally(() => setLoading(false))
    }
  }, [status, router])

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!session?.user) return null

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">הטיולים שלי</h1>
        <div className="flex gap-3">
          <Link
            href="/"
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            חזרה
          </Link>
          <Link
            href="/trips/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            טיול חדש
          </Link>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-lg text-zinc-500 dark:text-zinc-400">אין טיולים עדיין</p>
          <Link
            href="/trips/new"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            צור טיול ראשון
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/trips/${trip.id}`}
              className={`rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md ${
                trip.isShared && trip.role !== "owner"
                  ? "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
                  : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold">{trip.name}</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{trip.destination}</p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                    {new Date(trip.startDate!).toLocaleDateString("he-IL")} -{" "}
                    {new Date(trip.endDate!).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {trip.role === "owner" && trip.isShared && (
                    <span className="whitespace-nowrap rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      משותף
                    </span>
                  )}
                  {trip.role !== "owner" && (
                    <span className="whitespace-nowrap rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                      שיתפו איתי
                    </span>
                  )}
                  {trip.role === "owner" && trip.members.length > 0 && (
                    <div className="flex">
                      {trip.members.slice(0, 4).map((m, i) => (
                        <div
                          key={i}
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-[10px] font-bold text-white dark:border-zinc-800"
                          style={{ marginRight: i > 0 ? "-6px" : "0", zIndex: trip.members.length - i }}
                          title={m.name ?? ""}
                        >
                          {m.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
