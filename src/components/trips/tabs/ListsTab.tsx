"use client"

import { useState } from "react"
import { PackingList } from "@/components/lists/PackingList"
import { ShoppingList } from "@/components/lists/ShoppingList"
import type { TripRole } from "@/types/sharing"

export function ListsTab({ tripId, role: _role }: { tripId: string; role: TripRole }) {
  const [listTab, setListTab] = useState<"packing" | "shopping">("packing")

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 self-start rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        <button
          onClick={() => setListTab("packing")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            listTab === "packing"
              ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-700 dark:text-blue-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          רשימת ציוד
        </button>
        <button
          onClick={() => setListTab("shopping")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            listTab === "shopping"
              ? "bg-white text-green-600 shadow-sm dark:bg-zinc-700 dark:text-green-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
          }`}
        >
          רשימת קניות
        </button>
      </div>

      {/* Content */}
      {listTab === "packing" ? (
        <PackingList tripId={tripId} />
      ) : (
        <ShoppingList tripId={tripId} />
      )}
    </div>
  )
}
