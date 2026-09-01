"use client"

import { useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { PackingList } from "@/components/lists/PackingList"
import { ShoppingList } from "@/components/lists/ShoppingList"
import { TodoList } from "@/components/lists/TodoList"
import type { TripRole } from "@/types/sharing"

type ListTab = "packing" | "shopping" | "todos"

const TABS: { key: ListTab; label: string; activeClass: string }[] = [
  {
    key: "packing",
    label: "רשימת ציוד",
    activeClass: "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400",
  },
  {
    key: "shopping",
    label: "רשימת קניות",
    activeClass: "bg-white text-green-600 shadow-sm dark:bg-zinc-700 dark:text-green-400",
  },
  {
    key: "todos",
    label: "רשימת מטלות",
    activeClass: "bg-white text-purple-600 shadow-sm dark:bg-zinc-700 dark:text-purple-400",
  },
]

function parseList(value: string | null): ListTab {
  return TABS.some((t) => t.key === value) ? (value as ListTab) : "packing"
}

export function ListsTab({ tripId, role: _role }: { tripId: string; role: TripRole }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // In the URL for the same reason as the parent tab: the shopping list is
  // shared and gets refreshed constantly to pick up other people's ticks, and
  // every refresh used to drop the user back on the packing list.
  const listTab = parseList(searchParams.get("list"))

  const selectList = useCallback(
    (key: ListTab) => {
      const next = new URLSearchParams(searchParams.toString())
      next.set("list", key)
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 self-start rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => selectList(tab.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              listTab === tab.key
                ? tab.activeClass
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {listTab === "packing" && <PackingList tripId={tripId} />}
      {listTab === "shopping" && <ShoppingList tripId={tripId} />}
      {listTab === "todos" && <TodoList tripId={tripId} />}
    </div>
  )
}
