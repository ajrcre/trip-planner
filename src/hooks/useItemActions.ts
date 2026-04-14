"use client"

import { useState } from "react"

interface UseItemActionsOptions {
  tripId: string
  /** API path segment, e.g. "attractions" or "restaurants" */
  entityPath: string
  onUpdate: () => void
}

export function useItemActions({ tripId, entityPath, onUpdate }: UseItemActionsOptions) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function handleStatusChange(id: string, status: string) {
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

  return { updatingId, handleStatusChange, handleDelete, handleFieldUpdate }
}
