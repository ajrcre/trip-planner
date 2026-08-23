// Maps Google Place types to Hebrew attraction type labels.
//
// Mirrors store-types.ts / cuisine-types.ts, with one deliberate difference:
// those two store the Hebrew label, this stores the Google type key ("museum").
// The key is what the icon lookup needs (attractionTypeIcons in icons.ts), and
// the label stays derivable from it via attractionTypeLabel().

export const attractionTypeMap: Record<string, string> = {
  museum: "מוזיאון",
  art_gallery: "גלריה",
  aquarium: "אקווריום",
  zoo: "גן חיות",
  amusement_park: "פארק שעשועים",
  water_park: "פארק מים",
  national_park: "פארק לאומי",
  state_park: "פארק",
  botanical_garden: "גן בוטני",
  garden: "גן",
  park: "פארק",
  beach: "חוף",
  hiking_area: "מסלול הליכה",
  natural_feature: "אתר טבע",
  historical_landmark: "אתר היסטורי",
  historical_place: "אתר היסטורי",
  church: "כנסייה",
  mosque: "מסגד",
  synagogue: "בית כנסת",
  hindu_temple: "מקדש",
  place_of_worship: "אתר דת",
  performing_arts_theater: "תיאטרון",
  movie_theater: "קולנוע",
  library: "ספרייה",
  stadium: "אצטדיון",
  sports_complex: "מתחם ספורט",
  winery: "יקב",
  cable_car: "רכבל",
  funicular: "רכבל",
  observation_deck: "נקודת תצפית",
  shopping_mall: "קניון",
  market: "שוק",
  // Types the backfill found in real trip data that would otherwise fall back
  // to the generic landmark.
  playground: "מגרש משחקים",
  amusement_center: "מרכז שעשועים",
  ski_resort: "אתר סקי",
  go_karting_venue: "קארטינג",
  sports_activity_location: "פעילות ספורט",
  sports_club: "מועדון ספורט",
  spa: "ספא",
  // Accommodation occasionally saved to the attractions list.
  hotel: "לינה",
  lodging: "לינה",
}

/**
 * First recognised type in Google's own ordering wins. Google's generic
 * catch-alls (`tourist_attraction`, `point_of_interest`, `establishment`) are
 * deliberately absent from the map, so they are skipped over rather than
 * shadowing the specific type that determines the icon.
 */
export function mapAttractionType(types: string[]): string | null {
  for (const type of types) {
    if (attractionTypeMap[type]) return type
  }
  return null
}

/** Hebrew label for a stored attraction type. */
export function attractionTypeLabel(type: string | null | undefined): string | null {
  if (!type) return null
  return attractionTypeMap[type] ?? null
}
