"use client"

export function RatingStars({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5

  return (
    <span className="flex items-center gap-0.5 text-amber-500" dir="ltr">
      {Array.from({ length: 5 }, (_, i) => {
        if (i < fullStars) return <span key={i}>&#9733;</span>
        if (i === fullStars && hasHalf) return <span key={i}>&#9733;</span>
        return (
          <span key={i} className="text-zinc-300 dark:text-zinc-600">
            &#9733;
          </span>
        )
      })}
    </span>
  )
}
