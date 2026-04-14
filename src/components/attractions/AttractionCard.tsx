"use client"

import { ItemCard, type DiscoveredItem } from "@/components/shared/ItemCard"

export interface DiscoveredAttraction extends DiscoveredItem {
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

function TypeTags({ attraction }: { attraction: DiscoveredAttraction }) {
  const displayTypes = attraction.types
    .filter((t) => typeLabels[t])
    .slice(0, 3)

  return (
    <>
      <h3 className="text-sm font-semibold leading-tight">{attraction.name}</h3>
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
    </>
  )
}

export function AttractionCard({
  attraction,
  savedIds,
  onSave,
}: AttractionCardProps) {
  return (
    <ItemCard
      item={attraction}
      savedIds={savedIds}
      onSave={onSave}
      gradientClasses="from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30"
      headerTextClasses="text-blue-700 dark:text-blue-300"
      typeContent={<TypeTags attraction={attraction} />}
      wantLabel={<>&#10084;&#65039; רוצה</>}
      maybeLabel={<>&#129300; אולי</>}
    />
  )
}
