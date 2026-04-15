"use client"

import { useState, useEffect, useRef } from "react"
import type { TripRole, TripMember, PendingInvite, TripMembersResponse } from "@/types/sharing"

interface OwnerInfo {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

export function ShareExportButtons({
  tripId,
  tripName,
  role,
}: {
  tripId: string
  tripName: string
  role: TripRole
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showSharePopover, setShowSharePopover] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Members panel state
  const [showMembersPanel, setShowMembersPanel] = useState(false)
  const [members, setMembers] = useState<TripMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [owner, setOwner] = useState<OwnerInfo | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const membersPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSharePopover(false)
      }
      if (membersPanelRef.current && !membersPanelRef.current.contains(e.target as Node)) {
        setShowMembersPanel(false)
      }
    }
    if (showSharePopover || showMembersPanel) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showSharePopover, showMembersPanel])

  async function loadMembers() {
    const res = await fetch(`/api/trips/${tripId}/members`)
    if (res.ok) {
      const data: TripMembersResponse & { owner: OwnerInfo } = await res.json()
      setMembers(data.members)
      setPendingInvites(data.pendingInvites)
      setOwner(data.owner)
    }
  }

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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteError(null)
    try {
      const res = await fetch(`/api/trips/${tripId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), inviteRole }),
      })
      if (res.ok) {
        setInviteEmail("")
        await loadMembers()
      } else {
        const data = await res.json()
        setInviteError(data.error ?? "שגיאה בהזמנה")
      }
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    await fetch(`/api/trips/${tripId}/members/${userId}`, { method: "DELETE" })
    await loadMembers()
  }

  async function handleCancelInvite(inviteId: string) {
    await fetch(`/api/trips/${tripId}/members/invites/${inviteId}`, { method: "DELETE" })
    await loadMembers()
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await fetch(`/api/trips/${tripId}/members/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newRole }),
    })
    await loadMembers()
  }

  const roleLabel: Record<string, string> = { editor: "עורך", viewer: "צופה" }

  return (
    <div className="relative flex gap-2">
      {(role === "owner" || role === "editor") && (
        <button
          onClick={() => {
            setShowMembersPanel((prev) => !prev)
            if (!showMembersPanel) loadMembers()
          }}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
        >
          משתתפים
        </button>
      )}
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

      {showMembersPanel && (
        <div
          ref={membersPanelRef}
          className="absolute top-full left-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-4 shadow-lg sm:w-96 dark:border-zinc-600 dark:bg-zinc-800"
        >
          <h4 className="mb-3 text-sm font-semibold">ניהול משתתפים</h4>

          {/* Invite form — owner only */}
          {role === "owner" && (
            <form onSubmit={handleInvite} className="mb-4 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="כתובת אימייל"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                  dir="ltr"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                >
                  <option value="editor">עורך</option>
                  <option value="viewer">צופה</option>
                </select>
              </div>
              {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
              <button
                type="submit"
                disabled={inviteLoading || !inviteEmail.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {inviteLoading ? "..." : "הזמן"}
              </button>
            </form>
          )}

          {/* Owner row */}
          {owner && (
            <div className="mb-1 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-700/50">
              <div className="flex items-center gap-2">
                {owner.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={owner.image} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                    {owner.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <span className="text-sm font-medium">{owner.name ?? owner.email}</span>
              </div>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                בעלים
              </span>
            </div>
          )}

          {/* Member rows */}
          {members.map((m) => (
            <div key={m.userId} className="mb-1 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-700/50">
              <div className="flex items-center gap-2">
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image} alt="" className="h-6 w-6 rounded-full" />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                    {m.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <span className="text-sm">{m.name ?? m.email}</span>
              </div>
              <div className="flex items-center gap-1">
                {role === "owner" ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                      className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-xs text-zinc-700 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                    >
                      <option value="editor">עורך</option>
                      <option value="viewer">צופה</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      className="rounded p-0.5 text-zinc-400 transition-colors hover:text-red-500"
                      title="הסר"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-zinc-500">{roleLabel[m.role] ?? m.role}</span>
                )}
              </div>
            </div>
          ))}

          {/* Pending invite rows */}
          {pendingInvites.length > 0 && (
            <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-700">
              <p className="mb-2 text-xs font-medium text-zinc-500">הזמנות ממתינות</p>
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="mb-1 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-900/20">
                  <div>
                    <span className="text-sm" dir="ltr">{inv.invitedEmail}</span>
                    <span className="mr-2 text-xs text-zinc-500">{roleLabel[inv.role] ?? inv.role}</span>
                  </div>
                  {role === "owner" && (
                    <button
                      onClick={() => handleCancelInvite(inv.id)}
                      className="rounded p-0.5 text-zinc-400 transition-colors hover:text-red-500"
                      title="בטל הזמנה"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {members.length === 0 && pendingInvites.length === 0 && !owner && (
            <p className="text-center text-sm text-zinc-500">אין משתתפים עדיין</p>
          )}
        </div>
      )}
    </div>
  )
}
