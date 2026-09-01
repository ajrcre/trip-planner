"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { Icon } from "@/components/icons/Icon"

// This button lives in the root layout, so a static import put the whole chat —
// drawer, message list, action-proposal cards — into every page's first load,
// including the ones where the button renders nothing.
const ChatDrawer = dynamic(() => import("./ChatDrawer"), { ssr: false })

export default function GlobalAiButton() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const online = useOnlineStatus()

  // Extract tripId from URL like /trips/[tripId] or /trips/[tripId]/...
  const match = pathname.match(/^\/trips\/([^/]+)/)
  const tripId = match?.[1]

  // Only show when we have a trip context
  if (!tripId || tripId === "new") return null

  // The assistant is a round trip to Gemini every time, so offline the button
  // would only ever produce an error. Hiding it is less confusing than a
  // disabled control the user keeps tapping.
  if (!online) return null

  return (
    <>
      {/* Floating AI button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl active:scale-95"
          title="עוזר AI לתכנון"
        >
          <Icon name="ai" size="lg" />
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
