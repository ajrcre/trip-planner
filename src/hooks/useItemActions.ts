"use client"

import { useState } from "react"

import { useOnlineStatus } from "./useOnlineStatus"

interface UseItemActionsOptions {
  tripId: string
  /** API path segment, e.g. "attractions" or "restaurants" */
  entityPath: string
  onUpdate: () => void
}

/**
 * Shared CRUD for attractions, restaurants and grocery stores.
 *
 * These writes are not queued offline — unlike a checklist tick there is no
 * safe way to replay a status change or a delete hours later without knowing
 * what else happened in between. Instead `readOnly` lets callers disable the
 * controls, and the handlers refuse to fire as a backstop.
 */
export function useItemActions({ tripId, entityPath, onUpdate }: UseItemActionsOptions) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const online = useOnlineStatus()
  const readOnly = !online

  async function handleStatusChange(id: string, status: string) {
    if (readOnly) return
    setUpdatingId(id)
    try {
      await fetch(`/api/trips/${tripId}/${entityPath}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      onUpdate()
    } catch (error) {
      console.error("Status update failed:", error)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (readOnly) return
    setUpdatingId(id)
    try {
      await fetch(`/api/trips/${tripId}/${entityPath}/${id}`, {
        method: "DELETE",
      })
      onUpdate()
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleFieldUpdate(id: string, data: Record<string, unknown>) {
    if (readOnly) return
    setUpdatingId(id)
    try {
      await fetch(`/api/trips/${tripId}/${entityPath}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      onUpdate()
    } catch (error) {
      console.error("Update failed:", error)
    } finally {
      setUpdatingId(null)
    }
  }

  return { updatingId, readOnly, handleStatusChange, handleDelete, handleFieldUpdate }
}
