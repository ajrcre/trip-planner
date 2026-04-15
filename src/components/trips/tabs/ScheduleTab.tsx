"use client"

import { useState, useEffect } from "react"
import { ScheduleView } from "@/components/schedule/ScheduleView"
import type { Trip } from "../TripDashboard"
import type { TripRole } from "@/types/sharing"

export function ScheduleTab({ trip, role: _role }: { trip: Trip; role: TripRole }) {
  const [attractions, setAttractions] = useState<{ id: string; name: string; status: string }[]>([])
  const [restaurants, setRestaurants] = useState<{ id: string; name: string; status: string }[]>([])
  const [groceryStores, setGroceryStores] = useState<{ id: string; name: string; status: string }[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const [attRes, restRes, grocRes] = await Promise.all([
          fetch(`/api/trips/${trip.id}/attractions`),
          fetch(`/api/trips/${trip.id}/restaurants`),
          fetch(`/api/trips/${trip.id}/grocery-stores`),
        ])
        if (attRes.ok) {
          const data = await attRes.json()
          setAttractions(data.map((a: { id: string; name: string; status: string }) => ({
            id: a.id,
            name: a.name,
            status: a.status,
          })))
        }
        if (restRes.ok) {
          const data = await restRes.json()
          setRestaurants(data.map((r: { id: string; name: string; status: string }) => ({
            id: r.id,
            name: r.name,
            status: r.status,
          })))
        }
        if (grocRes.ok) {
          const data = await grocRes.json()
          setGroceryStores(data.map((g: { id: string; name: string; status: string }) => ({
            id: g.id,
            name: g.name,
            status: g.status,
          })))
        }
      } catch (error) {
        console.error("Failed to fetch data for schedule:", error)
      }
    }
    fetchData()
  }, [trip.id])

  return (
    <ScheduleView
      trip={{
        id: trip.id,
        startDate: trip.startDate,
        endDate: trip.endDate,
        accommodation: trip.accommodation,
        flights: trip.flights,
        carRental: trip.carRental,
        attractions,
        restaurants,
        groceryStores,
      }}
    />
  )
}
