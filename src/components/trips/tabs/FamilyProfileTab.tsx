"use client"

import { useState, useEffect, useCallback } from "react"
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
  additionalContext: string | null
}

const ROLE_LABELS: Record<string, string> = {
  parent: "הורה",
  child: "ילד",
  other: "מבוגר אחר",
}

const SPECIAL_NEEDS_OPTIONS = [
  "עגלה",
  "כסא בטיחות בוסטר",
  "כסא בטיחות מלא",
  "לול",
  "מגבלת ניידות",
]

function calculateAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// ─── Member card (view + inline edit) ────────────────────────────────────────

function MemberCard({
  member,
  tripId,
  canEdit,
  onChanged,
}: {
  member: FamilyMember
  tripId: string
  canEdit: boolean
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.name)
  const [dob, setDob] = useState(member.dateOfBirth.split("T")[0])
  const [role, setRole] = useState(member.role)
  const [specialNeeds, setSpecialNeeds] = useState<string[]>(member.specialNeeds)
  const [loading, setLoading] = useState(false)

  const toggle = (need: string) =>
    setSpecialNeeds((p) => (p.includes(need) ? p.filter((n) => n !== need) : [...p, need]))

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/profile/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dateOfBirth: dob, role, specialNeeds }),
      })
      if (res.ok) { onChanged(); setEditing(false) }
    } finally { setLoading(false) }
  }

  async function handleDelete() {
    if (!confirm(`למחוק את ${member.name}?`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/profile/members/${member.id}`, { method: "DELETE" })
      if (res.ok) onChanged()
    } finally { setLoading(false) }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">שם</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">תאריך לידה</label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">תפקיד</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700">
              <option value="parent">הורה</option>
              <option value="child">ילד</option>
              <option value="other">מבוגר אחר</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">צרכים מיוחדים</label>
            <div className="flex flex-wrap gap-2">
              {SPECIAL_NEEDS_OPTIONS.map((need) => (
                <button key={need} type="button" onClick={() => toggle(need)}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    specialNeeds.includes(need)
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  }`}>
                  {need}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? "שומר..." : "שמור"}
            </button>
            <button onClick={() => setEditing(false)}
              className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600">
              ביטול
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{member.name}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {ROLE_LABELS[member.role] ?? member.role} · גיל {calculateAge(member.dateOfBirth)}
          </p>
          {member.specialNeeds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {member.specialNeeds.map((need) => (
                <span key={need} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {need}
                </span>
              ))}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setEditing(true)}
              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600">
              ערוך
            </button>
            <button onClick={handleDelete} disabled={loading}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800">
              מחק
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Add member form ──────────────────────────────────────────────────────────

function AddMemberForm({ tripId, onAdded, onCancel }: { tripId: string; onAdded: () => void; onCancel: () => void }) {
  const [name, setName] = useState("")
  const [dob, setDob] = useState("")
  const [role, setRole] = useState("parent")
  const [specialNeeds, setSpecialNeeds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const toggle = (need: string) =>
    setSpecialNeeds((p) => (p.includes(need) ? p.filter((n) => n !== need) : [...p, need]))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !dob) return
    setLoading(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/profile/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dateOfBirth: dob, role, specialNeeds }),
      })
      if (res.ok) { onAdded() }
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950">
      <h3 className="mb-4 text-base font-semibold">הוסף משתתף</h3>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">שם</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">תאריך לידה</label>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">תפקיד</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700">
            <option value="parent">הורה</option>
            <option value="child">ילד</option>
            <option value="other">מבוגר אחר</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">צרכים מיוחדים</label>
          <div className="flex flex-wrap gap-2">
            {SPECIAL_NEEDS_OPTIONS.map((need) => (
              <button key={need} type="button" onClick={() => toggle(need)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  specialNeeds.includes(need)
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                }`}>
                {need}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "מוסיף..." : "הוסף"}
          </button>
          <button type="button" onClick={onCancel}
            className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600">
            ביטול
          </button>
        </div>
      </div>
    </form>
  )
}

// ─── Additional context textarea ──────────────────────────────────────────────

function AdditionalContextEditor({
  tripId,
  initial,
  canEdit,
}: {
  tripId: string
  initial: string | null
  canEdit: boolean
}) {
  const [value, setValue] = useState(initial ?? "")
  const [saved, setSaved] = useState(true)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalContext: value }),
      })
      if (res.ok) setSaved(true)
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="font-medium">הקשר נוסף לעוזר AI</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            מידע שיועבר לעוזר AI בכל שיחה — מאפיינים מיוחדים, מגבלות, העדפות ספציפיות לטיול זה
          </p>
        </div>
        {!saved && canEdit && (
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "שומר..." : "שמור"}
          </button>
        )}
        {saved && canEdit && value !== (initial ?? "") && (
          <span className="text-xs text-green-600">נשמר ✓</span>
        )}
      </div>
      {canEdit ? (
        <textarea
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false) }}
          rows={4}
          placeholder="לדוגמה: סבא מצטרף לחלק מהטיול ויש לו קושי בהליכה ממושכת. אנחנו רוצים לאכול כשר. הילדה הבכורה מתלהבת במיוחד ממוזיאונים."
          className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:placeholder:text-zinc-500"
          dir="auto"
        />
      ) : (
        value ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap" dir="auto">{value}</p>
        ) : (
          <p className="text-sm text-zinc-400">אין מידע נוסף</p>
        )
      )}
    </div>
  )
}

// ─── Main tab component ───────────────────────────────────────────────────────

export function FamilyProfileTab({ tripId, role }: { tripId: string; role: TripRole }) {
  const [profile, setProfile] = useState<FamilyProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const canEdit = role === "owner" || role === "editor"

  const loadProfile = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/profile`)
    if (res.ok) {
      const data = await res.json()
      setProfile(data)
    }
    setLoading(false)
  }, [tripId])

  useEffect(() => { loadProfile() }, [loadProfile])

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
            <button onClick={() => handleCreate(false)} disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
              {creating ? "..." : "צור פרופיל לטיול"}
            </button>
            <button onClick={() => handleCreate(true)} disabled={creating}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
              {creating ? "..." : "ייבא מברירת המחדל"}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">פרופיל משפחה לטיול</h2>
        {!canEdit && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 dark:bg-zinc-700">
            צפייה בלבד
          </span>
        )}
      </div>

      {/* Members */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">משתתפים ({profile.members.length})</h3>
          {canEdit && !showAddForm && (
            <button onClick={() => setShowAddForm(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
              + הוסף משתתף
            </button>
          )}
        </div>

        {showAddForm && (
          <AddMemberForm
            tripId={tripId}
            onAdded={async () => { await loadProfile(); setShowAddForm(false) }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {profile.members.length === 0 && !showAddForm ? (
          <p className="rounded-lg border border-dashed border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            אין משתתפים — {canEdit ? 'לחץ "+ הוסף משתתף" כדי להוסיף' : 'הפרופיל ריק'}
          </p>
        ) : (
          profile.members.map((m) => (
            <MemberCard key={m.id} member={m} tripId={tripId} canEdit={canEdit} onChanged={loadProfile} />
          ))
        )}
      </div>

      {/* Additional AI context */}
      <AdditionalContextEditor
        tripId={tripId}
        initial={profile.additionalContext}
        canEdit={canEdit}
      />

      {/* Preferences summary (read-only) */}
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-3 font-medium">העדפות טיול</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-zinc-500">קצב: </span>{profile.pace}</div>
          <div><span className="text-zinc-500">ללא עצירות: </span>{profile.noLayovers ? "כן" : "לא"}</div>
          {profile.attractionTypes.length > 0 && (
            <div className="col-span-2"><span className="text-zinc-500">אטרקציות: </span>{profile.attractionTypes.join(", ")}</div>
          )}
          {profile.foodPreferences.length > 0 && (
            <div className="col-span-2"><span className="text-zinc-500">העדפות אוכל: </span>{profile.foodPreferences.join(", ")}</div>
          )}
        </div>
        {canEdit && (
          <p className="mt-3 text-xs text-zinc-400">
            לעדכון העדפות הטיול, ערוך את{" "}
            <a href="/family" className="underline hover:text-zinc-600">פרופיל המשפחה הברירת המחדל</a>
            {" "}ואז צור פרופיל חדש לטיול זה.
          </p>
        )}
      </div>
    </div>
  )
}
