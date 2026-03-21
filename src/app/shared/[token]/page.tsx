"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { TripMap } from "@/components/maps/TripMap"

interface SharedTrip {
  id: string
  name: string
  destination: string
  startDate: string
  endDate: string
  accommodation: {
    name?: string
    address?: string
    checkIn?: string
    checkOut?: string
    contact?: string
    bookingReference?: string
    coordinates?: { lat: number; lng: number }
  } | null
  flights: {
    outbound?: {
      flightNumber?: string
      departureAirport?: string
      departureTime?: string
      arrivalAirport?: string
      arrivalTime?: string
    }
    return?: {
      flightNumber?: string
      departureAirport?: string
      departureTime?: string
      arrivalAirport?: string
      arrivalTime?: string
    }
  } | null
  carRental: {
    company?: string
    pickupLocation?: string
    returnLocation?: string
    additionalDetails?: string
  } | null
  attractions: Array<{
    id: string
    name: string
    address?: string | null
    lat?: number | null
    lng?: number | null
    phone?: string | null
    website?: string | null
    ratingGoogle?: number | null
    status: string
    bookingRequired: boolean
    specialNotes?: string | null
  }>
  restaurants: Array<{
    id: string
    name: string
    cuisineType?: string | null
    address?: string | null
    lat?: number | null
    lng?: number | null
    phone?: string | null
    ratingGoogle?: number | null
    kidFriendly: boolean
    status: string
  }>
  dayPlans: Array<{
    id: string
    date: string
    dayType: string
    activities: Array<{
      id: string
      sortOrder: number
      timeStart?: string | null
      timeEnd?: string | null
      type: string
      notes?: string | null
      attraction?: { name: string; address?: string | null } | null
      restaurant?: { name: string; address?: string | null } | null
    }>
  }>
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("he-IL")
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function googleMapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function googleMapsNavLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}:</span>
      <span>{value}</span>
    </div>
  )
}

export default function SharedTripPage() {
  const params = useParams()
  const token = params.token as string
  const [trip, setTrip] = useState<SharedTrip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTrip() {
      try {
        const res = await fetch(`/api/shared/${token}`)
        if (!res.ok) {
          setError("הטיול לא נמצא או שהקישור אינו תקף")
          return
        }
        const data = await res.json()
        setTrip(data)
      } catch {
        setError("שגיאה בטעינת הטיול")
      } finally {
        setLoading(false)
      }
    }
    fetchTrip()
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-lg text-zinc-500">טוען...</div>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-lg text-red-600">{error || "הטיול לא נמצא"}</p>
        </div>
      </div>
    )
  }

  const dayTypeLabels: Record<string, string> = {
    travel: "יום נסיעה",
    rest: "יום מנוחה",
    activity: "יום טיול",
  }

  const statusLabels: Record<string, string> = {
    approved: "מאושר",
    maybe: "אולי",
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-zinc-900">{trip.name}</h1>
          <p className="mt-2 text-lg text-zinc-600">
            {trip.destination} | {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
          </p>
          <div className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
            תצוגה משותפת
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Flights */}
          {trip.flights && (trip.flights.outbound?.flightNumber || trip.flights.return?.flightNumber) && (
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">טיסות</h2>
              <div className="flex flex-col gap-4">
                {trip.flights.outbound?.flightNumber && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-zinc-600">טיסת הלוך</h3>
                    <InfoRow label="מספר טיסה" value={trip.flights.outbound.flightNumber} />
                    <InfoRow
                      label="יציאה"
                      value={
                        trip.flights.outbound.departureAirport
                          ? `${trip.flights.outbound.departureAirport}${trip.flights.outbound.departureTime ? ` - ${formatDateTime(trip.flights.outbound.departureTime)}` : ""}`
                          : undefined
                      }
                    />
                    <InfoRow
                      label="נחיתה"
                      value={
                        trip.flights.outbound.arrivalAirport
                          ? `${trip.flights.outbound.arrivalAirport}${trip.flights.outbound.arrivalTime ? ` - ${formatDateTime(trip.flights.outbound.arrivalTime)}` : ""}`
                          : undefined
                      }
                    />
                  </div>
                )}
                {trip.flights.return?.flightNumber && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-zinc-600">טיסת חזור</h3>
                    <InfoRow label="מספר טיסה" value={trip.flights.return.flightNumber} />
                    <InfoRow
                      label="יציאה"
                      value={
                        trip.flights.return.departureAirport
                          ? `${trip.flights.return.departureAirport}${trip.flights.return.departureTime ? ` - ${formatDateTime(trip.flights.return.departureTime)}` : ""}`
                          : undefined
                      }
                    />
                    <InfoRow
                      label="נחיתה"
                      value={
                        trip.flights.return.arrivalAirport
                          ? `${trip.flights.return.arrivalAirport}${trip.flights.return.arrivalTime ? ` - ${formatDateTime(trip.flights.return.arrivalTime)}` : ""}`
                          : undefined
                      }
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Accommodation */}
          {trip.accommodation && (trip.accommodation.name || trip.accommodation.address) && (
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">לינה</h2>
              <InfoRow label="שם" value={trip.accommodation.name} />
              <InfoRow label="כתובת" value={trip.accommodation.address} />
              <InfoRow label="צ'ק-אין" value={trip.accommodation.checkIn ? formatDateTime(trip.accommodation.checkIn) : undefined} />
              <InfoRow label="צ'ק-אאוט" value={trip.accommodation.checkOut ? formatDateTime(trip.accommodation.checkOut) : undefined} />
              <InfoRow label="פרטי קשר" value={trip.accommodation.contact} />
              {trip.accommodation.address && (
                <a
                  href={googleMapsLink(trip.accommodation.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-lg bg-blue-50 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100"
                >
                  נווט בגוגל מפות
                </a>
              )}
            </section>
          )}

          {/* Car Rental */}
          {trip.carRental && (trip.carRental.company || trip.carRental.pickupLocation) && (
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">השכרת רכב</h2>
              <InfoRow label="חברה" value={trip.carRental.company} />
              <InfoRow label="מיקום איסוף" value={trip.carRental.pickupLocation} />
              <InfoRow label="מיקום החזרה" value={trip.carRental.returnLocation} />
              <InfoRow label="פרטים נוספים" value={trip.carRental.additionalDetails} />
            </section>
          )}

          {/* Map */}
          {trip.accommodation?.coordinates ? (
            <TripMap
              center={trip.accommodation.coordinates}
              attractions={trip.attractions
                .filter((a): a is typeof a & { lat: number; lng: number } => a.lat != null && a.lng != null)
                .map((a) => ({ lat: a.lat, lng: a.lng, name: a.name }))}
              restaurants={trip.restaurants
                .filter((r): r is typeof r & { lat: number; lng: number } => r.lat != null && r.lng != null)
                .map((r) => ({ lat: r.lat, lng: r.lng, name: r.name }))}
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50">
              <span className="text-sm text-zinc-400">אין נתוני מיקום לינה להצגת מפה</span>
            </div>
          )}

          {/* Daily Schedule */}
          {trip.dayPlans.length > 0 && (
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">לו&quot;ז יומי</h2>
              <div className="flex flex-col gap-6">
                {trip.dayPlans.map((day) => (
                  <div key={day.id}>
                    <h3 className="mb-2 font-semibold text-zinc-700">
                      {formatDate(day.date)} - {dayTypeLabels[day.dayType] || day.dayType}
                    </h3>
                    {day.activities.length > 0 ? (
                      <ul className="flex flex-col gap-2 pr-4">
                        {day.activities.map((activity) => {
                          const timePart = activity.timeStart
                            ? `${activity.timeStart}${activity.timeEnd ? `-${activity.timeEnd}` : ""}`
                            : ""
                          const namePart =
                            activity.type === "attraction" && activity.attraction
                              ? activity.attraction.name
                              : activity.type === "restaurant" && activity.restaurant
                                ? activity.restaurant.name
                                : activity.type === "travel"
                                  ? "נסיעה"
                                  : activity.type === "free_time"
                                    ? "זמן חופשי"
                                    : activity.type
                          const address =
                            activity.attraction?.address || activity.restaurant?.address

                          return (
                            <li key={activity.id} className="flex items-start gap-2 text-sm">
                              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
                              <div>
                                <span>
                                  {timePart ? `${timePart} - ` : ""}
                                  {namePart}
                                </span>
                                {activity.notes && (
                                  <span className="text-zinc-500"> ({activity.notes})</span>
                                )}
                                {address && (
                                  <a
                                    href={googleMapsLink(address)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mr-2 text-blue-500 hover:underline"
                                  >
                                    נווט
                                  </a>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-400">אין פעילויות מתוכננות</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Attractions Table */}
          {trip.attractions.length > 0 && (
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">אטרקציות</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-600">
                      <th className="px-3 py-2 text-right font-medium">שם</th>
                      <th className="px-3 py-2 text-right font-medium">כתובת</th>
                      <th className="px-3 py-2 text-right font-medium">דירוג</th>
                      <th className="px-3 py-2 text-right font-medium">סטטוס</th>
                      <th className="px-3 py-2 text-right font-medium">ניווט</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trip.attractions.map((a) => (
                      <tr key={a.id} className="border-b border-zinc-100">
                        <td className="px-3 py-2 font-medium">{a.name}</td>
                        <td className="px-3 py-2 text-zinc-600">{a.address || "-"}</td>
                        <td className="px-3 py-2">{a.ratingGoogle || "-"}</td>
                        <td className="px-3 py-2">{statusLabels[a.status] || a.status}</td>
                        <td className="px-3 py-2">
                          {a.lat && a.lng ? (
                            <a
                              href={googleMapsNavLink(a.lat, a.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              נווט
                            </a>
                          ) : a.address ? (
                            <a
                              href={googleMapsLink(a.address)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              נווט
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Restaurants Table */}
          {trip.restaurants.length > 0 && (
            <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-semibold">מסעדות</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-600">
                      <th className="px-3 py-2 text-right font-medium">שם</th>
                      <th className="px-3 py-2 text-right font-medium">סוג מטבח</th>
                      <th className="px-3 py-2 text-right font-medium">דירוג</th>
                      <th className="px-3 py-2 text-right font-medium">ידידותי לילדים</th>
                      <th className="px-3 py-2 text-right font-medium">ניווט</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trip.restaurants.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-100">
                        <td className="px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-zinc-600">{r.cuisineType || "-"}</td>
                        <td className="px-3 py-2">{r.ratingGoogle || "-"}</td>
                        <td className="px-3 py-2">{r.kidFriendly ? "כן" : "לא"}</td>
                        <td className="px-3 py-2">
                          {r.lat && r.lng ? (
                            <a
                              href={googleMapsNavLink(r.lat, r.lng)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              נווט
                            </a>
                          ) : r.address ? (
                            <a
                              href={googleMapsLink(r.address)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              נווט
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-zinc-400">
          נוצר באמצעות מתכנן טיולים
        </div>
      </div>
    </div>
  )
}
