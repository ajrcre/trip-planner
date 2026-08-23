"use client"

import { useState } from "react"
import type { DayPlanData } from "./DayTimeline"
import type { Accommodation } from "@/lib/accommodations"
import { formatDayForWhatsApp } from "@/lib/format-whatsapp"
import { WhatsAppIcon } from "@/components/icons/brands"

export function CopyToWhatsAppButton({
  dayPlan,
  tripAccommodations,
}: {
  dayPlan: DayPlanData
  tripAccommodations: Accommodation[]
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = formatDayForWhatsApp(dayPlan, tripAccommodations)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      <WhatsAppIcon className="h-4 w-4" />
      {copied ? "הועתק!" : "העתק ל-WhatsApp"}
    </button>
  )
}
