"use client"

import { ChecklistManager, type ChecklistConfig } from "./ChecklistManager"
import type { StageDef } from "./StageChip"
import { PACKING_STAGE_LABELS } from "@/lib/packing-stages"

// Each stage implies the ones before it: an item in the suitcase is one you
// have, and a verified item is one that is in the suitcase.
export const PACKING_STAGES: StageDef[] = [
  {
    label: PACKING_STAGE_LABELS[0],
    icon: "✓",
    chipClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    barClass: "bg-blue-500",
  },
  {
    label: PACKING_STAGE_LABELS[1],
    icon: "🧳",
    chipClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    barClass: "bg-amber-500",
  },
  {
    label: PACKING_STAGE_LABELS[2],
    icon: "✓✓",
    chipClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    barClass: "bg-green-500",
  },
]

const PACKING_CONFIG: ChecklistConfig = {
  apiPath: "packing",
  stages: PACKING_STAGES,
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
