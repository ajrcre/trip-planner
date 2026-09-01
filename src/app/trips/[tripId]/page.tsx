import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { getAuthSession } from "@/lib/auth"
import { getTripPayload } from "@/lib/trip-payload"
import { TripDashboard, type Trip } from "@/components/trips/TripDashboard"
import { TripDashboardSkeleton } from "@/components/trips/TripDashboardSkeleton"

/**
 * Rendered on the server so the trip arrives in the HTML.
 *
 * The client version of this page waited on two serial round trips before it
 * could paint anything — the session, then the trip — which on a hotel
 * connection meant several seconds of spinner every time the app was opened.
 */
export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>
}) {
  const session = await getAuthSession()
  if (!session?.user?.id) redirect("/")

  const { tripId } = await params
  const trip = await getTripPayload(tripId, session.user.id)

  if (!trip) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 text-center">
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
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/trips"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          חזרה לטיולים
        </Link>
      </div>
      {/* The dashboard reads the active tab from the query string, and
          `useSearchParams` needs a Suspense boundary to hydrate under a
          server-rendered page — without one the whole subtree stays inert.
          Keyed by trip so navigating between two trips remounts it rather than
          showing the previous trip's data from local state. */}
      {/* The dashboard reads the active tab from the query string, and
          `useSearchParams` needs a Suspense boundary to hydrate under a
          server-rendered page. Keyed by trip so navigating between two trips
          remounts it rather than showing the previous trip's data from local
          state. */}
      <Suspense fallback={<TripDashboardSkeleton />}>
        <TripDashboard
          key={trip.id}
          trip={JSON.parse(JSON.stringify(trip)) as Trip}
          role={trip.role}
        />
      </Suspense>
    </div>
  )
}
