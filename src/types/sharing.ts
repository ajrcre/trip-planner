export type TripRole = "owner" | "editor" | "viewer"

export interface TripMember {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: "editor" | "viewer"
}

export interface PendingInvite {
  id: string
  invitedEmail: string
  role: "editor" | "viewer"
  createdAt: string
}

export interface TripMembersResponse {
  members: TripMember[]
  pendingInvites: PendingInvite[]
}

export interface TripListItem {
  id: string
  name: string
  destination: string
  startDate: string | null
  endDate: string | null
  isShared: boolean
  role: TripRole
  members: { name: string | null; image: string | null }[]
}
