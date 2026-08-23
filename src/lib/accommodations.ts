// Accommodation helpers for multi-accommodation support

export interface Accommodation {
  name?: string;
  address?: string;
  /** Booking site or property URL when stored on the trip */
  website?: string;
  checkIn?: string; // ISO date or datetime string
  checkOut?: string; // ISO date or datetime string
  contact?: string;
  bookingReference?: string;
  notes?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export type AccommodationStatus = "check-in" | "check-out" | "staying";

export interface AccommodationForDay {
  accommodation: Accommodation;
  status: AccommodationStatus;
}

/** A date string is usable only if it starts with a real YYYY-MM-DD. */
function isParseableDate(dateStr: string | undefined): boolean {
  if (!dateStr) return false
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return false
  return !Number.isNaN(new Date(dateStr.slice(0, 10)).getTime())
}

/**
 * True when an accommodation carries a date that cannot be parsed.
 *
 * Day matching is a string-prefix comparison, so a malformed date — an
 * extraction that wrote the literal "YYYY" placeholder, say — matches no day
 * at all and silently removes the accommodation from every travel-time
 * calculation. Callers surface this so it cannot skew estimates unnoticed.
 *
 * Having no dates at all is a normal state and is not reported here.
 */
export function hasUnparseableDates(accommodation: Accommodation): boolean {
  const { checkIn, checkOut } = accommodation
  if (!checkIn && !checkOut) return false
  if (checkIn && !isParseableDate(checkIn)) return true
  if (checkOut && !isParseableDate(checkOut)) return true
  return false
}

/**
 * Extract the date part (YYYY-MM-DD) from a date/datetime string.
 */
function toDateOnly(dateStr: string): string {
  return dateStr.slice(0, 10);
}

/**
 * Given an array of accommodations and a day's date string,
 * returns which accommodations are relevant to that day with their status.
 *
 * - day equals checkIn date -> "check-in"
 * - day equals checkOut date -> "check-out"
 * - day is between checkIn and checkOut -> "staying"
 * - Accommodations without both checkIn and checkOut are skipped
 */
export function getAccommodationsForDay(
  accommodations: Accommodation[],
  dayDate: string
): AccommodationForDay[] {
  const day = toDateOnly(dayDate);
  const results: AccommodationForDay[] = [];

  for (const accommodation of accommodations) {
    if (!accommodation.checkIn && !accommodation.checkOut) {
      continue;
    }

    const checkIn = isParseableDate(accommodation.checkIn)
      ? toDateOnly(accommodation.checkIn!)
      : null;
    const checkOut = isParseableDate(accommodation.checkOut)
      ? toDateOnly(accommodation.checkOut!)
      : null;

    if (!checkIn && !checkOut) {
      continue;
    }

    if (checkIn && day === checkIn) {
      results.push({ accommodation, status: "check-in" });
    } else if (checkOut && day === checkOut) {
      results.push({ accommodation, status: "check-out" });
    } else if (checkIn && checkOut && day > checkIn && day < checkOut) {
      results.push({ accommodation, status: "staying" });
    }
  }

  return results;
}

/**
 * Normalize accommodation data for backward compatibility.
 *
 * - null/undefined -> []
 * - array -> filter to entries that have name or address
 * - single object with name or address -> wrap in array
 * - otherwise -> []
 */
export function normalizeAccommodations(
  data: unknown
): Accommodation[] {
  if (data == null) {
    return [];
  }

  if (Array.isArray(data)) {
    return data.filter(
      (entry) =>
        entry != null &&
        typeof entry === "object" &&
        (("name" in entry && entry.name) ||
          ("address" in entry && entry.address))
    ) as Accommodation[];
  }

  if (
    typeof data === "object" &&
    (("name" in data && (data as Record<string, unknown>).name) ||
      ("address" in data && (data as Record<string, unknown>).address))
  ) {
    return [data as Accommodation];
  }

  return [];
}
