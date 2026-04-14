export const cuisineTypeMap: Record<string, string> = {
  italian_restaurant: "איטלקי",
  greek_restaurant: "יווני",
  japanese_restaurant: "יפני",
  chinese_restaurant: "סיני",
  thai_restaurant: "תאילנדי",
  indian_restaurant: "הודי",
  mexican_restaurant: "מקסיקני",
  french_restaurant: "צרפתי",
  turkish_restaurant: "טורקי",
  korean_restaurant: "קוריאני",
  vietnamese_restaurant: "וייטנאמי",
  spanish_restaurant: "ספרדי",
  american_restaurant: "אמריקאי",
  mediterranean_restaurant: "ים תיכוני",
  middle_eastern_restaurant: "מזרח תיכוני",
  seafood_restaurant: "דגים/פירות ים",
  steak_house: "בשרים",
  pizza_restaurant: "פיצה",
  sushi_restaurant: "סושי",
  hamburger_restaurant: "המבורגר",
  ice_cream_shop: "גלידה",
  bakery: "מאפייה",
  cafe: "בית קפה",
  coffee_shop: "בית קפה",
  bar: "בר",
  fast_food_restaurant: "מזון מהיר",
  restaurant: "מסעדה",
}

export function mapCuisineType(types: string[]): string | null {
  for (const type of types) {
    if (cuisineTypeMap[type]) return cuisineTypeMap[type]
  }
  return null
}
