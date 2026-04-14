"use client"

import { type ReactNode } from "react"
import { RatingStars } from "./RatingStars"
import { googleMapsUrl } from "@/lib/url-helpers"
import { formatAmPmTimesInText } from "@/lib/time-parsing"

/* ------------------------------------------------------------------ */
/*  Shared base type – every discovered item must have these fields    */
/* ------------------------------------------------------------------ */

export interface DiscoveredItem {
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
  websiteUri?: string | null
  openingHours?: string[] | null
  travelTimeMinutes?: number | null
  distanceKm?: number | null
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ItemCardProps<T extends DiscoveredItem> {
  item: T
  savedIds: Set<string>
  onSave: (item: T, status: string) => void

  /** Tailwind gradient classes for the placeholder header.
   *  e.g. "from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30" */
  gradientClasses: string

  /** Tailwind text color for the name inside the gradient header.
   *  e.g. "text-blue-700 dark:text-blue-300" */
  headerTextClasses: string

  /** Render-prop slot rendered right after the name <h3>.
   *  Use this for type-specific content (type tags, cuisine badge, etc.). */
  typeContent?: ReactNode

  /** Optional extra content for the "want" button label (e.g. emoji prefix). */
  wantLabel?: ReactNode
  /** Optional extra content for the "maybe" button label. */
  maybeLabel?: ReactNode
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ItemCard<T extends DiscoveredItem>({
  item,
  savedIds,
  onSave,
  gradientClasses,
  headerTextClasses,
  typeContent,
  wantLabel,
  maybeLabel,
}: ItemCardProps<T>) {
  const isSaved = savedIds.has(item.googlePlaceId)

  const mapsUrl = googleMapsUrl(item.name, {
    lat: item.lat,
    lng: item.lng,
    googlePlaceId: item.googlePlaceId,
  })

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800">
      {/* Placeholder photo */}
      <div
        className={`flex h-32 items-center justify-center bg-gradient-to-br ${gradientClasses}`}
      >
        <span
          className={`px-4 text-center text-sm font-medium ${headerTextClasses}`}
        >
          {item.name}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Name + optional type-specific content */}
        {typeContent ? (
          typeContent
        ) : (
          <h3 className="text-sm font-semibold leading-tight">{item.name}</h3>
        )}

        {/* Travel time & distance */}
        {item.travelTimeMinutes != null && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
              />
            </svg>
            <span>
              {item.travelTimeMinutes} דק׳ מהלינה
              {item.distanceKm != null && ` (${item.distanceKm} ק״מ)`}
            </span>
          </div>
        )}

        {/* Rating */}
        {item.rating && (
          <div className="flex items-center gap-2 text-xs">
            <RatingStars rating={item.rating} />
            <span className="text-zinc-500">
              ({item.userRatingCount ?? 0})
            </span>
          </div>
        )}

        {/* Address */}
        {item.address && (
          <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-500">
            {item.address}
          </p>
        )}

        {/* Opening hours */}
        {item.openingHours && item.openingHours.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400">
              שעות פתיחה
            </summary>
            <ul
              className="mt-1 space-y-0.5 text-zinc-500 dark:text-zinc-400"
              dir="ltr"
            >
              {item.openingHours.map((line, i) => (
                <li key={i}>{formatAmPmTimesInText(line)}</li>
              ))}
            </ul>
          </details>
        )}

        {/* Links */}
        <div className="flex items-center gap-3 text-xs">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            מפה
          </a>
          {item.websiteUri && (
            <a
              href={item.websiteUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              אתר
            </a>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-auto flex gap-2 pt-2">
          {isSaved ? (
            <span className="flex w-full items-center justify-center rounded-lg bg-green-50 py-1.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
              &#10003; נשמר
            </span>
          ) : (
            <>
              <button
                onClick={() => onSave(item, "want")}
                className="flex-1 rounded-lg bg-rose-50 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30"
              >
                {wantLabel ?? "רוצה"}
              </button>
              <button
                onClick={() => onSave(item, "maybe")}
                className="flex-1 rounded-lg bg-amber-50 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
              >
                {maybeLabel ?? "אולי"}
              </button>
              <button
                onClick={() => onSave(item, "rejected")}
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
