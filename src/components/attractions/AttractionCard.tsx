"use client"

interface DiscoveredAttraction {
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
}

interface AttractionCardProps {
  attraction: DiscoveredAttraction
  savedIds: Set<string>
  onSave: (attraction: DiscoveredAttraction, status: string) => void
}

const typeLabels: Record<string, string> = {
  tourist_attraction: "אטרקציה",
  museum: "מוזיאון",
  park: "פארק",
  amusement_park: "פארק שעשועים",
  zoo: "גן חיות",
  aquarium: "אקווריום",
  art_gallery: "גלריה",
  church: "כנסייה",
  hindu_temple: "מקדש",
  mosque: "מסגד",
  synagogue: "בית כנסת",
  stadium: "אצטדיון",
  shopping_mall: "קניון",
  beach: "חוף",
  campground: "קמפינג",
  hiking_area: "שביל הליכה",
  national_park: "פארק לאומי",
  historical_landmark: "אתר היסטורי",
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

export function AttractionCard({
  attraction,
  savedIds,
  onSave,
}: AttractionCardProps) {
  const isSaved = savedIds.has(attraction.googlePlaceId)

  const displayTypes = attraction.types
    .filter((t) => typeLabels[t])
    .slice(0, 3)

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800">
      {/* Placeholder photo */}
      <div className="flex h-32 items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30">
        <span className="px-4 text-center text-sm font-medium text-blue-700 dark:text-blue-300">
          {attraction.name}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Name */}
        <h3 className="text-sm font-semibold leading-tight">{attraction.name}</h3>

        {/* Description */}
        {attraction.description && (
          <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400">
            {attraction.description}
          </p>
        )}

        {/* Rating */}
        {attraction.rating && (
          <div className="flex items-center gap-2 text-xs">
            <RatingStars rating={attraction.rating} />
            <span className="text-zinc-500">
              ({attraction.userRatingCount ?? 0})
            </span>
          </div>
        )}

        {/* Address */}
        {attraction.address && (
          <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-500">
            {attraction.address}
          </p>
        )}

        {/* Type tags */}
        {displayTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {displayTypes.map((type) => (
              <span
                key={type}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
              >
                {typeLabels[type]}
              </span>
            ))}
          </div>
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
                onClick={() => onSave(attraction, "want")}
                className="flex-1 rounded-lg bg-rose-50 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30"
              >
                &#10084;&#65039; רוצה
              </button>
              <button
                onClick={() => onSave(attraction, "maybe")}
                className="flex-1 rounded-lg bg-amber-50 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
              >
                &#129300; אולי
              </button>
              <button
                onClick={() => onSave(attraction, "rejected")}
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
