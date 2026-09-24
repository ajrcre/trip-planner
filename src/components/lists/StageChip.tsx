"use client"

import { useEffect, useRef, useState } from "react"

export interface StageDef {
  /** Full label, shown on the chip and in the progress card. */
  label: string
  icon: string
  /** Complete Tailwind class strings, so the JIT compiler can see them. */
  chipClass: string
  barClass: string
}

const UNMARKED = {
  label: "לא סומן",
  icon: "○",
  chipClass:
    "border border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-600 dark:text-zinc-500",
}

const LONG_PRESS_MS = 500

/**
 * One button per item that walks through the stages: a tap moves to the next
 * one and wraps back to "not marked" after the last. A long press (or right
 * click) opens a menu for jumping straight to any stage, so fixing a mistake
 * does not mean going all the way around.
 */
export function StageChip({
  stage,
  stages,
  onChange,
}: {
  stage: number
  stages: StageDef[]
  onChange: (stage: number) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set when a long press opened the menu, so the click that follows the
  // release does not also advance the stage.
  const longPressed = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [menuOpen])

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = null
  }

  const current = stage > 0 ? stages[stage - 1] : UNMARKED
  const options = [UNMARKED, ...stages]

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onPointerDown={() => {
          longPressed.current = false
          pressTimer.current = setTimeout(() => {
            longPressed.current = true
            setMenuOpen(true)
          }, LONG_PRESS_MS)
        }}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => {
          e.preventDefault()
          cancelPress()
          longPressed.current = true
          setMenuOpen(true)
        }}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false
            return
          }
          onChange((stage + 1) % (stages.length + 1))
        }}
        title="לחיצה מקדמת שלב · לחיצה ארוכה לבחירת שלב"
        className={`flex min-w-[5.5rem] select-none items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${current.chipClass}`}
      >
        <span aria-hidden>{current.icon}</span>
        {current.label}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-1 flex w-36 flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {options.map((option, index) => (
            <button
              key={option.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                if (index !== stage) onChange(index)
              }}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-right text-xs font-medium ${option.chipClass} ${
                index === stage ? "ring-2 ring-zinc-400 dark:ring-zinc-500" : ""
              }`}
            >
              <span aria-hidden>{option.icon}</span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
