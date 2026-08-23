"use client"

import { Star, StarHalf } from "lucide-react"

/**
 * `dir="ltr"` so the filled stars stay on the left in the RTL page, the way a
 * rating is conventionally read.
 */
export function RatingStars({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5

  return (
    <span className="flex items-center gap-0.5 text-amber-500" dir="ltr">
      {Array.from({ length: 5 }, (_, i) => {
        if (i < fullStars) {
          return <Star key={i} className="h-3.5 w-3.5 fill-current" strokeWidth={1.75} aria-hidden="true" />
        }
        if (i === fullStars && hasHalf) {
          return <StarHalf key={i} className="h-3.5 w-3.5 fill-current" strokeWidth={1.75} aria-hidden="true" />
        }
        return (
          <Star
            key={i}
            className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )
      })}
    </span>
  )
}
