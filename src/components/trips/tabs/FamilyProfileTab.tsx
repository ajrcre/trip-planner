"use client"

import { useState, useEffect } from "react"
import type { TripRole } from "@/types/sharing"

interface FamilyMember {
  id: string
  name: string
  role: string
  dateOfBirth: string
  specialNeeds: string[]
}

interface FamilyProfileData {
  id: string
  attractionTypes: string[]
  foodPreferences: string[]
  noLayovers: boolean
  pace: string
  members: FamilyMember[]
}

export function FamilyProfileTab({ tripId, role }: { tripId: string; role: TripRole }) {
  const [profile, setProfile] = useState<FamilyProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const canEdit = role === "owner" || role === "editor"

  async function loadProfile() {
    const res = await fetch(`/api/trips/${tripId}/profile`)
    if (res.ok) {
      const data = await res.json()
      setProfile(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  async function handleCreate(seedFromDefault: boolean) {
    setCreating(true)
    const res = await fetch(`/api/trips/${tripId}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seedFromDefault }),
    })
    if (res.ok) await loadProfile()
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-zinc-200 py-12 text-center dark:border-zinc-700">
        <div className="text-4xl">👨‍👩‍👧‍👦</div>
        <div>
          <p className="font-semibold text-zinc-700 dark:text-zinc-300">אין פרופיל משפחה לטיול זה</p>
          <p className="mt-1 text-sm text-zinc-500">ניתן ליצור פרופיל ייעודי לטיול זה</p>
        </div>
        {canEdit && (
          <div className="flex gap-3">
            <button
              onClick={() => handleCreate(false)}
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "..." : "צור פרופיל לטיול"}
            </button>
            <button
              onClick={() => handleCreate(true)}
              disabled={creating}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
            >
              {creating ? "..." : "ייבא מברירת המחדל"}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">פרופיל משפחה לטיול</h2>
        {!canEdit && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 dark:bg-zinc-700">
            צפייה בלבד
          </span>
        )}
      </div>

      {/* Members list */}
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-3 font-medium">משתתפים ({profile.members.length})</h3>
        {profile.members.length === 0 ? (
          <p className="text-sm text-zinc-500">אין משתתפים</p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
              >
                <div>
                  <span className="font-medium">{m.name}</span>
                  <span className="mr-2 text-sm text-zinc-500">{m.role}</span>
                </div>
                {m.dateOfBirth && (
                  <span className="text-xs text-zinc-400">
                    {new Date(m.dateOfBirth).toLocaleDateString("he-IL")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preferences summary */}
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-3 font-medium">העדפות</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-zinc-500">קצב: </span>
            {profile.pace}
          </div>
          <div>
            <span className="text-zinc-500">ללא עצירות: </span>
            {profile.noLayovers ? "כן" : "לא"}
          </div>
          {profile.attractionTypes.length > 0 && (
            <div className="col-span-2">
              <span className="text-zinc-500">אטרקציות: </span>
              {profile.attractionTypes.join(", ")}
            </div>
          )}
          {profile.foodPreferences.length > 0 && (
            <div className="col-span-2">
              <span className="text-zinc-500">העדפות אוכל: </span>
              {profile.foodPreferences.join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
