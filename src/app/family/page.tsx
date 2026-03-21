"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MemberCard, AddMemberForm } from "@/components/family/MemberCard"
import { FamilyProfileForm } from "@/components/family/FamilyProfileForm"
import Link from "next/link"

interface FamilyMember {
  id: string
  name: string
  dateOfBirth: string
  role: string
  specialNeeds: string[]
}

interface FamilyProfile {
  id: string
  attractionTypes: string[]
  foodPreferences: string[]
  noLayovers: boolean
  preferredFlightStart: string | null
  preferredFlightEnd: string | null
  pace: string
  members: FamilyMember[]
}

export default function FamilyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<FamilyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/family")
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
      return
    }
    if (status === "authenticated") {
      fetchProfile()
    }
  }, [status, router, fetchProfile])

  const handleMemberUpdate = (updated: FamilyMember) => {
    setProfile((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
      }
    })
  }

  const handleMemberDelete = (id: string) => {
    setProfile((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        members: prev.members.filter((m) => m.id !== id),
      }
    })
  }

  const handleMemberAdd = (member: FamilyMember) => {
    setProfile((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        members: [...prev.members, member],
      }
    })
    setShowAddForm(false)
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">המשפחה שלי</h1>
        <Link
          href="/"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          חזרה
        </Link>
      </div>

      {/* Section 1: Family Members */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">בני משפחה</h2>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              הוסף בן משפחה
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {profile?.members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onUpdate={handleMemberUpdate}
              onDelete={handleMemberDelete}
            />
          ))}

          {profile?.members.length === 0 && !showAddForm && (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              לא נוספו בני משפחה עדיין
            </p>
          )}

          {showAddForm && (
            <AddMemberForm
              onAdd={handleMemberAdd}
              onCancel={() => setShowAddForm(false)}
            />
          )}
        </div>
      </section>

      {/* Section 2: Preferences */}
      {profile && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">העדפות</h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
            <FamilyProfileForm
              initialData={{
                attractionTypes: profile.attractionTypes,
                foodPreferences: profile.foodPreferences,
                noLayovers: profile.noLayovers,
                preferredFlightStart: profile.preferredFlightStart,
                preferredFlightEnd: profile.preferredFlightEnd,
                pace: profile.pace,
              }}
            />
          </div>
        </section>
      )}
    </div>
  )
}
