// Maps Google Place types to Hebrew store type labels

const storeTypeMap: Record<string, string> = {
  supermarket: "סופרמרקט",
  grocery_or_supermarket: "סופרמרקט",
  convenience_store: "מכולת",
  health_food_store: "טבע",
  organic_store: "אורגני",
  market: "שוק",
  farmers_market: "שוק איכרים",
  food_store: "חנות מזון",
  grocery_store: "מכולת",
}

export function mapStoreType(types: string[]): string | null {
  for (const type of types) {
    if (storeTypeMap[type]) return storeTypeMap[type]
  }
  return null
}
