"use client"

import { useState, useEffect, useRef } from "react"

export function ShareExportButtons({ tripId, tripName }: { tripId: string; tripName: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showSharePopover, setShowSharePopover] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSharePopover(false)
      }
    }
    if (showSharePopover) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showSharePopover])

  async function handleShare() {
    setShareLoading(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        const fullUrl = `${window.location.origin}${data.url}`
        setShareUrl(fullUrl)
        setShowSharePopover(true)
      }
    } catch (error) {
      console.error("Failed to generate share link:", error)
    } finally {
      setShareLoading(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea")
      textarea.value = shareUrl
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleExport() {
    setExportLoading(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/export`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${tripName}.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("Failed to export:", error)
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="relative flex gap-2">
      <button
        onClick={handleShare}
        disabled={shareLoading}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
      >
        {shareLoading ? "..." : "שתף"}
      </button>
      <button
        onClick={handleExport}
        disabled={exportLoading}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
      >
        {exportLoading ? "..." : "ייצא"}
      </button>

      {showSharePopover && shareUrl && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-4 shadow-lg sm:w-80 dark:border-zinc-600 dark:bg-zinc-800"
        >
          <h4 className="mb-2 text-sm font-semibold">קישור לשיתוף</h4>
          <p className="mb-3 text-xs text-zinc-500">
            כל מי שיקבל את הקישור יוכל לצפות בטיול (קריאה בלבד)
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
              dir="ltr"
            />
            <button
              onClick={handleCopy}
              className="flex-shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {copied ? "הועתק!" : "העתק"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
