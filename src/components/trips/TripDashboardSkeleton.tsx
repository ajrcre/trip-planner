/**
 * Placeholder shaped like the dashboard — title block, tab bar, content — so
 * the page does not jump when the real thing renders.
 */
export function TripDashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <div className="h-9 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 flex-1 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        ))}
      </div>

      <div className="h-64 rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" />
    </div>
  )
}
