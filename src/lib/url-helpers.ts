/**
 * Build a Google Maps search URL for a place.
 *
 * When latitude/longitude and a Google Place ID are available the link will
 * deep-link straight to the place; otherwise it falls back to a name search.
 */
export function googleMapsUrl(
  name: string,
  opts?: {
    lat?: number | null
    lng?: number | null
    googlePlaceId?: string | null
  },
): string {
  if (opts?.lat != null && opts?.lng != null && opts?.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${opts.lat},${opts.lng}&query_place_id=${opts.googlePlaceId}`
  }
  if (opts?.lat != null && opts?.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${opts.lat},${opts.lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`
}
