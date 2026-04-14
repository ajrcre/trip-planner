"use client"

import { ChecklistManager, type ChecklistConfig } from "./ChecklistManager"

const PACKING_CONFIG: ChecklistConfig = {
  apiPath: "packing",
  colorScheme: { primary: "blue", light: "blue" },
  labels: {
    progressLabel: "ארוזים",
    emptyState: "אין פריטים ברשימת הציוד",
    addPlaceholder: "הוסף פריט...",
  },
}

export function PackingList({ tripId }: { tripId: string }) {
  return <ChecklistManager tripId={tripId} config={PACKING_CONFIG} />
}
