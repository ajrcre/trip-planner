"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface TripSummary {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
}

export default function TripsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [trips, setTrips] = useState<TripSummary[]>([])
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
    <div className="mx-auto max-w-4xl px-4 py-8">
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
              className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
            >
              <h2 className="text-lg font-semibold">{trip.name}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{trip.destination}</p>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                {new Date(trip.startDate).toLocaleDateString("he-IL")} -{" "}
                {new Date(trip.endDate).toLocaleDateString("he-IL")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
