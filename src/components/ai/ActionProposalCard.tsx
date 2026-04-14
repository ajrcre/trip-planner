"use client"

import type {
  ActionProposal,
  AddActivityPayload,
  RemoveActivityPayload,
  ReplaceDayPayload,
  PlanFullTripPayload,
  ProposedActivity,
} from "@/types/ai-chat"

// ── Helper maps ──

const activityTypeLabels: Record<string, string> = {
  attraction: "אטרקציה",
  meal: "ארוחה",
  rest: "מנוחה",
  travel: "נסיעה",
  custom: "אחר",
  grocery: "קניות מכולת",
  lodging: "לינה",
}

const activityTypeIcons: Record<string, string> = {
  attraction: "🎢",
  meal: "🍽️",
  rest: "☕",
  travel: "🚗",
  custom: "📝",
  grocery: "🛒",
  lodging: "🏨",
}

const actionTypeConfig: Record<
  string,
  { icon: string; label: string }
> = {
  add_activity: { icon: "➕", label: "הוספת פעילות" },
  remove_activity: { icon: "➖", label: "הסרת פעילות" },
  replace_day_activities: { icon: "🔄", label: "עדכון יום" },
  plan_full_trip: { icon: "📋", label: "תכנון טיול מלא" },
}

// ── Helpers ──

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  })
}

function getActivityName(activity: ProposedActivity): string {
  return (
    activity.attractionName ||
    activity.restaurantName ||
    activity.notes ||
    activityTypeLabels[activity.type] ||
    activity.type
  )
}

function formatTimeRange(activity: ProposedActivity): string | null {
  if (!activity.timeStart) return null
  if (activity.timeEnd) return `${activity.timeStart}–${activity.timeEnd}`
  return activity.timeStart
}

// ── Sub-components ──

function ActivityRow({ activity }: { activity: ProposedActivity }) {
  const icon = activityTypeIcons[activity.type] || "📝"
  const name = getActivityName(activity)
  const time = formatTimeRange(activity)

  return (
    <div className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-1.5 text-sm dark:bg-zinc-800">
      <span>{icon}</span>
      <span className="font-medium">{name}</span>
      {time && (
        <span className="mr-auto text-xs text-zinc-500 dark:text-zinc-400">
          {time}
        </span>
      )}
    </div>
  )
}

function AddActivityPreview({ payload }: { payload: AddActivityPayload }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        📅 {formatDate(payload.dayDate)}
      </p>
      <ActivityRow activity={payload.activity} />
    </div>
  )
}

function RemoveActivityPreview({
  payload,
}: {
  payload: RemoveActivityPayload
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        📅 {formatDate(payload.dayDate)}
      </p>
      <div className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-1.5 text-sm line-through opacity-70 dark:bg-zinc-800">
        <span>❌</span>
        <span>{payload.activityDescription}</span>
      </div>
    </div>
  )
}

function ReplaceDayPreview({ payload }: { payload: ReplaceDayPayload }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        📅 {formatDate(payload.dayDate)} ·{" "}
        {payload.activities.length} פעילויות
      </p>
      <div className="space-y-1">
        {payload.activities.map((activity, i) => (
          <ActivityRow key={i} activity={activity} />
        ))}
      </div>
    </div>
  )
}

function PlanFullTripPreview({ payload }: { payload: PlanFullTripPayload }) {
  const totalActivities = payload.days.reduce(
    (sum, day) => sum + day.activities.length,
    0
  )

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        {payload.days.length} ימים · {totalActivities} פעילויות
      </p>
      <div className="max-h-60 space-y-3 overflow-y-auto">
        {payload.days.map((day) => (
          <div key={day.dayDate} className="space-y-1">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              📅 {formatDate(day.dayDate)}
            </p>
            {day.activities.map((activity, i) => (
              <ActivityRow key={i} activity={activity} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Status styling ──

const statusStyles: Record<string, string> = {
  pending: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950",
  approved:
    "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950",
  rejected:
    "border-red-200 bg-red-50 opacity-60 dark:border-red-800 dark:bg-red-950",
}

// ── Main component ──

interface ActionProposalCardProps {
  proposal: ActionProposal
  onApprove: () => void
  onReject: () => void
  isExecuting?: boolean
}

export default function ActionProposalCard({
  proposal,
  onApprove,
  onReject,
  isExecuting = false,
}: ActionProposalCardProps) {
  const config = actionTypeConfig[proposal.actionType]
  const cardStyle = statusStyles[proposal.status] || statusStyles.pending

  return (
    <div className={`rounded-lg border p-4 ${cardStyle}`}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">{config.icon}</span>
        <span className="font-semibold text-zinc-800 dark:text-zinc-100">
          {config.label}
        </span>
        {proposal.status === "approved" && (
          <span className="mr-auto rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
            ✅ אושר
          </span>
        )}
        {proposal.status === "rejected" && (
          <span className="mr-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
            ❌ בוטל
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
        {proposal.description}
      </p>

      {/* Preview */}
      <div className="mb-3">
        {proposal.payload.actionType === "add_activity" && (
          <AddActivityPreview
            payload={proposal.payload as AddActivityPayload}
          />
        )}
        {proposal.payload.actionType === "remove_activity" && (
          <RemoveActivityPreview
            payload={proposal.payload as RemoveActivityPayload}
          />
        )}
        {proposal.payload.actionType === "replace_day_activities" && (
          <ReplaceDayPreview
            payload={proposal.payload as ReplaceDayPayload}
          />
        )}
        {proposal.payload.actionType === "plan_full_trip" && (
          <PlanFullTripPreview
            payload={proposal.payload as PlanFullTripPayload}
          />
        )}
      </div>

      {/* Action buttons */}
      {proposal.status === "pending" && (
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={isExecuting}
            className="flex items-center gap-1 rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isExecuting ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              "✅ אשר"
            )}
          </button>
          <button
            onClick={onReject}
            disabled={isExecuting}
            className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ❌ בטל
          </button>
        </div>
      )}
    </div>
  )
}
