"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { TripDashboard } from "@/components/trips/TripDashboard"

export default function TripPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tripId = params.tripId as string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trip, setTrip] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
      return
    }
    if (status === "authenticated" && tripId) {
      fetch(`/api/trips/${tripId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found")
          return res.json()
        })
        .then((data) => setTrip(data))
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    }
  }, [status, router, tripId])

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!session?.user) return null

  if (error || !trip) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <p className="mb-4 text-lg text-zinc-500">הטיול לא נמצא</p>
        <Link
          href="/trips"
          className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          חזרה לטיולים
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/trips"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          חזרה לטיולים
        </Link>
      </div>
      <TripDashboard trip={trip} />
    </div>
  )
}
