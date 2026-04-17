"use client"

import { useState } from "react"

interface FamilyMember {
  id: string
  name: string
  dateOfBirth: string
  role: string
  specialNeeds: string[]
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
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

interface MemberCardProps {
  member: FamilyMember
  onUpdate: (member: FamilyMember) => void
  onDelete: (id: string) => void
}

export function MemberCard({ member, onUpdate, onDelete }: MemberCardProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.name)
  const [dateOfBirth, setDateOfBirth] = useState(member.dateOfBirth.split("T")[0])
  const [role, setRole] = useState(member.role)
  const [specialNeeds, setSpecialNeeds] = useState<string[]>(member.specialNeeds)
  const [loading, setLoading] = useState(false)

  const toggleSpecialNeed = (need: string) => {
    setSpecialNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]
    )
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/family/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dateOfBirth, role, specialNeeds }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate(updated)
        setEditing(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`למחוק את ${member.name}?`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/family/members/${member.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        onDelete(member.id)
      }
    } finally {
      setLoading(false)
    }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">שם</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">תאריך לידה</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">תפקיד</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            >
              <option value="parent">הורה</option>
              <option value="child">ילד</option>
              <option value="other">מבוגר אחר</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">צרכים מיוחדים</label>
            <div className="flex flex-wrap gap-2">
              {SPECIAL_NEEDS_OPTIONS.map((need) => (
                <button
                  key={need}
                  type="button"
                  onClick={() => toggleSpecialNeed(need)}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    specialNeeds.includes(need)
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  }`}
                >
                  {need}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "שומר..." : "שמור"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            >
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
          <h3 className="text-lg font-semibold">{member.name}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {ROLE_LABELS[member.role] || member.role} · גיל {calculateAge(member.dateOfBirth)}
          </p>
          {member.specialNeeds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {member.specialNeeds.map((need) => (
                <span
                  key={need}
                  className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                >
                  {need}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            ערוך
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg bg-red-100 px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
          >
            מחק
          </button>
        </div>
      </div>
    </div>
  )
}

interface AddMemberFormProps {
  onAdd: (member: FamilyMember) => void
  onCancel: () => void
}

export function AddMemberForm({ onAdd, onCancel }: AddMemberFormProps) {
  const [name, setName] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [role, setRole] = useState("parent")
  const [specialNeeds, setSpecialNeeds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const toggleSpecialNeed = (need: string) => {
    setSpecialNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !dateOfBirth) return

    setLoading(true)
    try {
      const res = await fetch("/api/family/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dateOfBirth, role, specialNeeds }),
      })
      if (res.ok) {
        const member = await res.json()
        onAdd(member)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950"
    >
      <h3 className="mb-4 text-lg font-semibold">הוסף בן משפחה</h3>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">שם</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">תאריך לידה</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">תפקיד</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
          >
            <option value="parent">הורה</option>
            <option value="child">ילד</option>
            <option value="other">מבוגר אחר</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">צרכים מיוחדים</label>
          <div className="flex flex-wrap gap-2">
            {SPECIAL_NEEDS_OPTIONS.map((need) => (
              <button
                key={need}
                type="button"
                onClick={() => toggleSpecialNeed(need)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  specialNeeds.includes(need)
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                }`}
              >
                {need}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "מוסיף..." : "הוסף"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            ביטול
          </button>
        </div>
      </div>
    </form>
  )
}
