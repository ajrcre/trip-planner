// Accommodation helpers for multi-accommodation support

export interface Accommodation {
  name: string;
  address: string;
  checkIn: string; // ISO date or datetime string
  checkOut: string; // ISO date or datetime string
  contact?: string;
  bookingReference?: string;
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

    const checkIn = accommodation.checkIn
      ? toDateOnly(accommodation.checkIn)
      : null;
    const checkOut = accommodation.checkOut
      ? toDateOnly(accommodation.checkOut)
      : null;

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
