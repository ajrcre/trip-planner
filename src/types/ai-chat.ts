// src/types/ai-chat.ts

// ── Chat message types ──

export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  /** If the assistant proposes an action, this is attached to the message */
  actionProposal?: ActionProposal
  timestamp: number
}

// ── Action proposal types ──

export type ActionType =
  | "add_activity"
  | "remove_activity"
  | "replace_day_activities"
  | "plan_full_trip"

export type ActionStatus = "pending" | "approved" | "rejected"

export interface ProposedActivity {
  type: string // "attraction" | "meal" | "rest" | "travel" | "custom" | "lodging"
  timeStart: string | null
  timeEnd: string | null
  notes: string | null
  attractionId: string | null
  attractionName: string | null
  restaurantId: string | null
  restaurantName: string | null
}

export interface ActionProposal {
  id: string
  actionType: ActionType
  status: ActionStatus
  /** Human-readable summary in Hebrew */
  description: string
  /** The raw function call args from Gemini */
  payload: AddActivityPayload | RemoveActivityPayload | ReplaceDayPayload | PlanFullTripPayload
}

export interface AddActivityPayload {
  actionType: "add_activity"
  dayDate: string // "YYYY-MM-DD"
  activity: ProposedActivity
}

export interface RemoveActivityPayload {
  actionType: "remove_activity"
  dayDate: string
  activityDescription: string // Gemini describes which to remove
  activityId?: string // resolved by backend if possible
}

export interface ReplaceDayPayload {
  actionType: "replace_day_activities"
  dayDate: string
  activities: ProposedActivity[]
}

export interface PlanFullTripPayload {
  actionType: "plan_full_trip"
  days: Array<{
    dayDate: string
    activities: ProposedActivity[]
  }>
}

// ── API request/response types ──

export interface ChatRequest {
  tripId: string
  messages: ChatMessage[]
}

export interface ChatResponse {
  message: ChatMessage
}

export interface ExecuteActionRequest {
  tripId: string
  proposal: ActionProposal
}

export interface ExecuteActionResponse {
  success: boolean
  error?: string
}
