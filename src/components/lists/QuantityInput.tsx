"use client"

import { useState } from "react"

/**
 * A small number field for an item's quantity. Saves on blur or Enter; an empty
 * field clears the quantity. The parent keys this on the saved value, so a
 * fresh value from the server resets the draft.
 */
export function QuantityInput({
  quantity,
  disabled,
  onSave,
}: {
  quantity: number | null | undefined
  disabled?: boolean
  onSave: (quantity: number | null) => void
}) {
  const [draft, setDraft] = useState(quantity ? String(quantity) : "")

  const commit = () => {
    const parsed = parseInt(draft, 10)
    const next = Number.isInteger(parsed) && parsed > 0 ? parsed : null
    setDraft(next ? String(next) : "")
    if (next !== (quantity ?? null)) onSave(next)
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      value={draft}
      placeholder="כמות"
      aria-label="כמות"
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
      className="w-14 shrink-0 rounded-md border border-zinc-200 bg-transparent px-1.5 py-0.5 text-center text-sm outline-none placeholder:text-[10px] placeholder:text-zinc-400 focus:border-green-500 disabled:opacity-40 dark:border-zinc-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  )
}
