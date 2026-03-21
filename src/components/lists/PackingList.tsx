"use client"

import { useState, useEffect, useCallback } from "react"

interface PackingItem {
  id: string
  category: string
  item: string
  checked: boolean
  forMember: string | null
  sortOrder: number
}

export function PackingList({ tripId }: { tripId: string }) {
  const [items, setItems] = useState<PackingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())
  const [newItemText, setNewItemText] = useState<Record<string, string>>({})
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryItemText, setNewCategoryItemText] = useState("")
  const [showNewCategory, setShowNewCategory] = useState(false)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/packing`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        // Open all categories by default
        const categories = new Set<string>(
          data.items.map((i: PackingItem) => i.category)
        )
        setOpenCategories(categories)
      }
    } catch (error) {
      console.error("Failed to fetch packing items:", error)
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const initFromTemplate = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/packing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init-from-template" }),
      })
      if (res.ok) {
        await fetchItems()
      }
    } catch (error) {
      console.error("Failed to init from template:", error)
    }
  }

  const toggleItem = async (item: PackingItem) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, checked: !i.checked } : i
      )
    )

    try {
      await fetch(`/api/trips/${tripId}/packing?itemId=${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: !item.checked }),
      })
    } catch (error) {
      console.error("Failed to toggle item:", error)
      // Revert on error
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, checked: item.checked } : i
        )
      )
    }
  }

  const deleteItem = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    try {
      await fetch(`/api/trips/${tripId}/packing?itemId=${itemId}`, {
        method: "DELETE",
      })
    } catch (error) {
      console.error("Failed to delete item:", error)
      await fetchItems()
    }
  }

  const addItem = async (category: string) => {
    const text = newItemText[category]?.trim()
    if (!text) return

    setNewItemText((prev) => ({ ...prev, [category]: "" }))

    try {
      const res = await fetch(`/api/trips/${tripId}/packing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, item: text }),
      })
      if (res.ok) {
        const newItem = await res.json()
        setItems((prev) => [...prev, newItem])
      }
    } catch (error) {
      console.error("Failed to add item:", error)
    }
  }

  const addNewCategoryItem = async () => {
    const cat = newCategoryName.trim()
    const text = newCategoryItemText.trim()
    if (!cat || !text) return

    setNewCategoryName("")
    setNewCategoryItemText("")
    setShowNewCategory(false)

    try {
      const res = await fetch(`/api/trips/${tripId}/packing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, item: text }),
      })
      if (res.ok) {
        const newItem = await res.json()
        setItems((prev) => [...prev, newItem])
        setOpenCategories((prev) => new Set([...prev, cat]))
      }
    } catch (error) {
      console.error("Failed to add item:", error)
    }
  }

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Group items by category
  const grouped: Record<string, PackingItem[]> = {}
  for (const item of items) {
    if (!grouped[item.category]) {
      grouped[item.category] = []
    }
    grouped[item.category].push(item)
  }

  const totalItems = items.length
  const checkedItems = items.filter((i) => i.checked).length

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <p className="text-zinc-500">אין פריטים ברשימת הציוד</p>
        <button
          onClick={initFromTemplate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          אתחל מתבנית
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            {checkedItems}/{totalItems} ארוזים
          </span>
          <span className="text-zinc-500">
            {totalItems > 0
              ? Math.round((checkedItems / totalItems) * 100)
              : 0}
            %
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{
              width: `${totalItems > 0 ? (checkedItems / totalItems) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Category sections */}
      {Object.entries(grouped).map(([category, categoryItems]) => {
        const isOpen = openCategories.has(category)
        const catChecked = categoryItems.filter((i) => i.checked).length
        const catTotal = categoryItems.length

        return (
          <div
            key={category}
            className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="flex w-full items-center justify-between p-4 text-right hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
                <span className="text-xs text-zinc-500">
                  {catChecked}/{catTotal}
                </span>
              </div>
              <h3 className="font-semibold">{category}</h3>
            </button>

            {/* Items */}
            {isOpen && (
              <div className="border-t border-zinc-100 dark:border-zinc-700">
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-700">
                  {categoryItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
                    >
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-zinc-300 hover:text-red-500 transition-colors"
                        title="מחק"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <label className="flex flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleItem(item)}
                          className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span
                          className={`flex-1 text-sm transition-all ${
                            item.checked
                              ? "text-zinc-400 line-through"
                              : "text-zinc-800 dark:text-zinc-200"
                          }`}
                        >
                          {item.item}
                        </span>
                        {item.forMember && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {item.forMember}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>

                {/* Add item form */}
                <div className="flex items-center gap-2 border-t border-zinc-100 px-4 py-2 dark:border-zinc-700">
                  <input
                    type="text"
                    placeholder="הוסף פריט..."
                    value={newItemText[category] || ""}
                    onChange={(e) =>
                      setNewItemText((prev) => ({
                        ...prev,
                        [category]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addItem(category)
                    }}
                    className="flex-1 bg-transparent text-sm text-right outline-none placeholder:text-zinc-400"
                    dir="rtl"
                  />
                  <button
                    onClick={() => addItem(category)}
                    disabled={!newItemText[category]?.trim()}
                    className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-40 transition-colors dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40"
                  >
                    הוסף
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Add new category */}
      {showNewCategory ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-600 dark:bg-zinc-800">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="שם קטגוריה..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm text-right outline-none focus:border-blue-500 dark:border-zinc-600"
              dir="rtl"
              autoFocus
            />
            <input
              type="text"
              placeholder="פריט ראשון..."
              value={newCategoryItemText}
              onChange={(e) => setNewCategoryItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addNewCategoryItem()
              }}
              className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm text-right outline-none focus:border-blue-500 dark:border-zinc-600"
              dir="rtl"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowNewCategory(false)}
                className="rounded-md px-3 py-1 text-xs text-zinc-500 hover:text-zinc-700"
              >
                ביטול
              </button>
              <button
                onClick={addNewCategoryItem}
                disabled={!newCategoryName.trim() || !newCategoryItemText.trim()}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                הוסף קטגוריה
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewCategory(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-3 text-sm text-zinc-500 hover:border-blue-400 hover:text-blue-500 transition-colors dark:border-zinc-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          הוסף קטגוריה חדשה
        </button>
      )}
    </div>
  )
}
