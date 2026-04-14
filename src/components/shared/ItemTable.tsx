"use client"

import { Fragment, type ReactNode } from "react"
import { formatAmPmTimesInText } from "@/lib/time-parsing"
import { statusLabels, statusColors } from "@/lib/status-config"
import type { StatusFilter } from "@/hooks/useTableFiltering"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BaseItem {
  id: string
  name: string
  status: string
  googlePlaceId: string | null
  lat: number | null
  lng: number | null
  address: string | null
  website: string | null
  ratingGoogle: number | null
  travelTimeMinutes: number | null
  openingHours: unknown
  phone: string | null
}

export interface ColumnDef<T> {
  key: string
  header: string
  render: (item: T, ctx: ColumnContext) => ReactNode
}

export interface ColumnContext {
  updatingId: string | null
  expandedId: string | null
  setExpandedId: (id: string | null) => void
}

export interface SortOption {
  value: string
  label: string
}

export interface ItemTableProps<T extends BaseItem> {
  items: T[]
  sorted: T[]
  columns: ColumnDef<T>[]
  sortOptions: SortOption[]
  sortField: string
  setSortField: (f: string) => void
  filter: StatusFilter
  setFilter: (f: StatusFilter) => void
  updatingId: string | null
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  handleStatusChange: (id: string, status: string) => void
  handleDelete: (id: string) => void
  emptyMessage: string
  /** Optional: render expanded row content below a row */
  renderExpanded?: (item: T, ctx: ColumnContext) => ReactNode
  /** Whether the entire row is clickable to toggle expand (restaurant style) */
  rowClickToExpand?: boolean
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function googleMapsUrl(item: { googlePlaceId: string | null; lat: number | null; lng: number | null; name: string }): string {
  if (item.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${item.lat ?? 0},${item.lng ?? 0}&query_place_id=${item.googlePlaceId}`
  }
  if (item.lat != null && item.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name)}`
}

export function formatOpeningHours(hours: unknown): string | null {
  if (!hours) return null
  if (typeof hours === "object" && hours !== null && "weekdayDescriptions" in hours) {
    const descs = (hours as { weekdayDescriptions?: string[] }).weekdayDescriptions
    if (!descs?.length) return null
    return descs.map((line) => formatAmPmTimesInText(line)).join("\n")
  }
  return null
}

// ---------------------------------------------------------------------------
// Shared column builders
// ---------------------------------------------------------------------------

export function nameColumn<T extends BaseItem>(): ColumnDef<T> {
  return {
    key: "name",
    header: "שם",
    render: (item, ctx) => (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <a
            href={googleMapsUrl(item)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-700 hover:underline dark:text-blue-400"
            onClick={(e) => e.stopPropagation()}
          >
            {item.name}
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation()
              ctx.setExpandedId(ctx.expandedId === item.id ? null : item.id)
            }}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            title="פרטים נוספים"
          >
            {ctx.expandedId === item.id ? "\u25B2" : "\u25BC"}
          </button>
        </div>
        {item.address && (
          <span className="text-xs text-zinc-500">{item.address}</span>
        )}
      </div>
    ),
  }
}

export function travelTimeColumn<T extends BaseItem & { travelDistanceKm?: number | null }>(): ColumnDef<T> {
  return {
    key: "travelTime",
    header: "זמן נסיעה",
    render: (item) =>
      item.travelTimeMinutes != null ? (
        <span className="whitespace-nowrap">
          {item.travelTimeMinutes} דק׳
          {item.travelDistanceKm != null && (
            <span className="text-xs text-zinc-400"> ({item.travelDistanceKm} ק״מ)</span>
          )}
        </span>
      ) : (
        "—"
      ),
  }
}

export function ratingColumn<T extends BaseItem>(): ColumnDef<T> {
  return {
    key: "rating",
    header: "דירוג",
    render: (item) =>
      item.ratingGoogle ? (
        <span className="flex items-center gap-1 whitespace-nowrap">
          {item.ratingGoogle}
          <span className="text-amber-500">{"\u2605"}</span>
        </span>
      ) : (
        "—"
      ),
  }
}

export function openingHoursColumn<T extends BaseItem>(): ColumnDef<T> {
  return {
    key: "openingHours",
    header: "שעות פתיחה",
    render: (item) =>
      item.openingHours &&
      typeof item.openingHours === "object" &&
      item.openingHours !== null &&
      "weekdayDescriptions" in (item.openingHours as Record<string, unknown>) ? (
        <details className="text-xs">
          <summary className="cursor-pointer whitespace-nowrap font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400">
            הצג שעות
          </summary>
          <ul className="mt-1 space-y-0.5 text-zinc-500" dir="ltr">
            {((item.openingHours as { weekdayDescriptions?: string[] }).weekdayDescriptions ?? []).map(
              (line: string, i: number) => (
                <li key={i}>{formatAmPmTimesInText(line)}</li>
              )
            )}
          </ul>
        </details>
      ) : (
        "—"
      ),
  }
}

export function statusColumn<T extends BaseItem>(
  handleStatusChange: (id: string, status: string) => void,
  updatingId: string | null,
): ColumnDef<T> {
  return {
    key: "status",
    header: "סטטוס",
    render: (item) => (
      <select
        value={item.status}
        onChange={(e) => handleStatusChange(item.id, e.target.value)}
        disabled={updatingId === item.id}
        className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${
          statusColors[item.status] ?? statusColors.maybe
        }`}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <option value="want">רוצה</option>
        <option value="maybe">אולי</option>
        <option value="rejected">לא מתאים</option>
      </select>
    ),
  }
}

export function linksColumn<T extends BaseItem>(): ColumnDef<T> {
  return {
    key: "links",
    header: "קישורים",
    render: (item) => (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <a
          href={googleMapsUrl(item)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-blue-600 hover:underline dark:text-blue-400"
          title="Google Maps"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          מפה
        </a>
        {item.website && (
          <a
            href={item.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-blue-600 hover:underline dark:text-blue-400"
            title="אתר רשמי"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            אתר
          </a>
        )}
      </div>
    ),
  }
}

export function deleteColumn<T extends BaseItem>(
  handleDelete: (id: string) => void,
  updatingId: string | null,
): ColumnDef<T> {
  return {
    key: "actions",
    header: "פעולות",
    render: (item) => (
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleDelete(item.id)
        }}
        disabled={updatingId === item.id}
        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        מחק
      </button>
    ),
  }
}

// ---------------------------------------------------------------------------
// ItemTable component
// ---------------------------------------------------------------------------

export function ItemTable<T extends BaseItem>({
  items,
  sorted,
  columns,
  sortOptions,
  sortField,
  setSortField,
  filter,
  setFilter,
  updatingId,
  expandedId,
  setExpandedId,
  handleStatusChange,
  handleDelete,
  emptyMessage,
  renderExpanded,
  rowClickToExpand = false,
}: ItemTableProps<T>) {
  const ctx: ColumnContext = { updatingId, expandedId, setExpandedId }

  if (items.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/50">
        <span className="text-sm text-zinc-400">{emptyMessage}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters and sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
          {(["all", "want", "maybe"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
              }`}
            >
              {f === "all" ? "הכל" : statusLabels[f]}
            </button>
          ))}
        </div>

        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
          dir="rtl"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm" dir="rtl">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-400"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-700 dark:bg-zinc-800">
            {sorted.map((item) => (
              <Fragment key={item.id}>
                <tr
                  className={
                    rowClickToExpand
                      ? "cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-750"
                      : undefined
                  }
                  onClick={
                    rowClickToExpand
                      ? () => setExpandedId(expandedId === item.id ? null : item.id)
                      : undefined
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-2 text-zinc-600 dark:text-zinc-400"
                    >
                      {col.render(item, ctx)}
                    </td>
                  ))}
                </tr>
                {renderExpanded && expandedId === item.id && (
                  <tr key={`${item.id}-expanded`}>
                    <td colSpan={columns.length}>
                      {renderExpanded(item, ctx)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
