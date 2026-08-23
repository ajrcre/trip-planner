"use client"

import { useRef } from "react"
import { wrapSelection, insertLink, applyListPrefix, type EditResult } from "@/lib/markdown-toolbar"
import { Icon } from "@/components/icons/Icon"

interface MarkdownTextareaProps {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  className?: string
}

const buttonClass =
  "rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-zinc-100"

export function MarkdownTextarea({ value, onChange, rows = 3, placeholder, className = "" }: MarkdownTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function applyEdit(fn: (v: string, s: number, e: number) => EditResult) {
    const el = ref.current
    if (!el) return
    const result = fn(value, el.selectionStart, el.selectionEnd)
    onChange(result.text)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  return (
    <div className={`overflow-hidden rounded border border-zinc-300 dark:border-zinc-600 ${className}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900/40">
        <button type="button" title="מודגש" className={`${buttonClass} font-bold`} onClick={() => applyEdit((v, s, e) => wrapSelection(v, s, e, "**", "**"))}>
          B
        </button>
        <button type="button" title="נטוי" className={`${buttonClass} italic`} onClick={() => applyEdit((v, s, e) => wrapSelection(v, s, e, "*", "*"))}>
          I
        </button>
        <button type="button" title="קו תחתון" className={`${buttonClass} underline`} onClick={() => applyEdit((v, s, e) => wrapSelection(v, s, e, "<u>", "</u>"))}>
          U
        </button>
        <button type="button" title="קו חוצה" className={`${buttonClass} line-through`} onClick={() => applyEdit((v, s, e) => wrapSelection(v, s, e, "~~", "~~"))}>
          S
        </button>
        <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
        <button type="button" title="קישור" className={buttonClass} onClick={() => applyEdit((v, s, e) => insertLink(v, s, e))}>
          <Icon name="link" size="md" />
        </button>
        <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
        <button type="button" title="רשימה ממוספרת" className={buttonClass} onClick={() => applyEdit((v, s, e) => applyListPrefix(v, s, e, true))}>
          1.
        </button>
        <button type="button" title="רשימת תבליטים" className={buttonClass} onClick={() => applyEdit((v, s, e) => applyListPrefix(v, s, e, false))}>
          •
        </button>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm focus:outline-none dark:bg-zinc-700"
      />
    </div>
  )
}
