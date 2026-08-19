"use client"

/**
 * Stands in for content that genuinely cannot work without a connection —
 * Google Maps tiles and remote place photos.
 *
 * Rendered instead of the live component rather than around it, so the map
 * loader never fires and leaves a blank grey box or a console full of failures.
 * The surrounding lists, addresses and coordinates stay readable, which is what
 * the user actually needs when navigating a foreign town on no signal.
 */
export function OfflinePlaceholder({
  message = "המפה אינה זמינה במצב לא מקוון",
  className = "",
}: {
  message?: string
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-600 dark:bg-zinc-800/50 ${className}`}
    >
      <svg
        className="h-6 w-6 text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
        />
      </svg>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
    </div>
  )
}
