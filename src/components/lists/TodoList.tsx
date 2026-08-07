"use client"

import { ChecklistManager, type ChecklistConfig } from "./ChecklistManager"

const TODO_CONFIG: ChecklistConfig = {
  apiPath: "todos",
  managedCategories: true,
  colorScheme: { primary: "purple", light: "purple" },
  labels: {
    progressLabel: "מטלות הושלמו",
    emptyState: "אין עדיין מטלות ברשימה",
    addPlaceholder: "הוסף מטלה...",
  },
}

export function TodoList({ tripId }: { tripId: string }) {
  return <ChecklistManager tripId={tripId} config={TODO_CONFIG} />
}
