"use client"

import { useMemo, useState } from "react"
import { statusOrder } from "@/lib/status-config"

export type StatusFilter = "all" | "want" | "maybe"

export interface SortConfig<F extends string> {
  field: F
  comparator: (a: { status: string }, b: { status: string }) => number
}

interface UseTableFilteringOptions<T extends { status: string }, F extends string> {
  items: T[]
  defaultSort: F
  sortComparators: Record<F, (a: T, b: T) => number>
}

export function useTableFiltering<T extends { status: string }, F extends string>({
  items,
  defaultSort,
  sortComparators,
}: UseTableFilteringOptions<T, F>) {
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [sortField, setSortField] = useState<F>(defaultSort)

  const sorted = useMemo(() => {
    const filtered = items.filter((item) => {
      if (filter === "all") return item.status !== "rejected"
      return item.status === filter
    })

    return [...filtered].sort(sortComparators[sortField])
  }, [items, filter, sortField, sortComparators])

  return { filter, setFilter, sortField, setSortField, sorted }
}

/** Common sort comparators reusable across entity types */
export const commonComparators = {
  byStatus: <T extends { status: string }>(a: T, b: T) =>
    (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3),
  byName: <T extends { name: string }>(a: T, b: T) =>
    a.name.localeCompare(b.name),
  byTravelTime: <T extends { travelTimeMinutes: number | null }>(a: T, b: T) =>
    (a.travelTimeMinutes ?? 999) - (b.travelTimeMinutes ?? 999),
  byRating: <T extends { ratingGoogle: number | null }>(a: T, b: T) =>
    (b.ratingGoogle ?? 0) - (a.ratingGoogle ?? 0),
}
