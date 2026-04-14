"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import ChatDrawer from "./ChatDrawer"

export default function GlobalAiButton() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Extract tripId from URL like /trips/[tripId] or /trips/[tripId]/...
  const match = pathname.match(/^\/trips\/([^/]+)/)
  const tripId = match?.[1]

  // Only show when we have a trip context
  if (!tripId || tripId === "new") return null

  return (
    <>
      {/* Floating AI button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95"
          title="עוזר AI לתכנון"
        >
          <span className="text-lg" aria-hidden="true">💡</span>
          <span className="hidden sm:inline">עוזר AI</span>
        </button>
      )}

      <ChatDrawer
        tripId={tripId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onScheduleUpdate={() => {
          // Trigger a custom event so any listening component can refresh
          window.dispatchEvent(new CustomEvent("schedule-updated"))
        }}
      />
    </>
  )
}
