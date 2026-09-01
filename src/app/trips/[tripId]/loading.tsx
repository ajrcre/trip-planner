import { TripDashboardSkeleton } from "@/components/trips/TripDashboardSkeleton"

/** Shown while the trip is fetched on the server. */
export default function TripLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 h-9 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
      <TripDashboardSkeleton />
    </div>
  )
}
