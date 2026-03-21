"use client"

interface DiscoveredRestaurant {
  googlePlaceId: string
  name: string
  description: string | null
  address: string | null
  lat: number | null
  lng: number | null
  rating: number | null
  userRatingCount: number | null
  photos: string[]
  types: string[]
  cuisineType: string | null
}

interface RestaurantCardProps {
  restaurant: DiscoveredRestaurant
  savedIds: Set<string>
  onSave: (restaurant: DiscoveredRestaurant, status: string) => void
}

function RatingStars({ rating }: { rating: number }) {
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

export function RestaurantCard({
  restaurant,
  savedIds,
  onSave,
}: RestaurantCardProps) {
  const isSaved = savedIds.has(restaurant.googlePlaceId)

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800">
      {/* Placeholder photo */}
      <div className="flex h-32 items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30">
        <span className="px-4 text-center text-sm font-medium text-orange-700 dark:text-orange-300">
          {restaurant.name}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Name + cuisine type badge */}
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-sm font-semibold leading-tight">{restaurant.name}</h3>
          {restaurant.cuisineType && (
            <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">
              {restaurant.cuisineType}
            </span>
          )}
        </div>

        {/* Description */}
        {restaurant.description && (
          <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
            {restaurant.description}
          </p>
        )}

        {/* Rating */}
        {restaurant.rating && (
          <div className="flex items-center gap-2 text-xs">
            <RatingStars rating={restaurant.rating} />
            <span className="text-zinc-500">
              ({restaurant.userRatingCount ?? 0})
            </span>
          </div>
        )}

        {/* Address */}
        {restaurant.address && (
          <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-500">
            {restaurant.address}
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-auto flex gap-2 pt-2">
          {isSaved ? (
            <span className="flex w-full items-center justify-center rounded-lg bg-green-50 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
              &#10003; נשמר
            </span>
          ) : (
            <>
              <button
                onClick={() => onSave(restaurant, "want")}
                className="flex-1 rounded-lg bg-rose-50 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30"
              >
                רוצה
              </button>
              <button
                onClick={() => onSave(restaurant, "maybe")}
                className="flex-1 rounded-lg bg-amber-50 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
              >
                אולי
              </button>
              <button
                onClick={() => onSave(restaurant, "rejected")}
                className="rounded-lg bg-zinc-100 px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
                title="לא מתאים"
              >
                &#10007;
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
