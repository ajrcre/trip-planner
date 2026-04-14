# Trip Sharing & Family Profile Design

**Date:** 2026-04-14  
**Status:** Approved

## Overview

Allow users to share trips with other users via email invitation. Shared trips include a trip-level family profile editable by all collaborators. Each user retains a personal default family profile. Roles control what shared users can do.

---

## Goals

- Owner can invite others to a trip by email, assigning a role (editor or viewer)
- Editors can modify trip content (attractions, schedule, restaurants, grocery lists, trip metadata) and the trip-level family profile
- Viewers can only read trip content — all edit controls are hidden
- Each user has a personal default family profile; trips can optionally have their own independent profile (created blank or copied from the owner's default on demand)
- Trips list shows clearly which trips are owned vs. shared with the user
- Non-owners can leave a shared trip themselves

---

## Out of Scope

- Email notifications to invitees (known limitation — invitees must be told to open the app and sign in)
- Real-time collaborative editing / conflict resolution
- Public share links (already exists separately via `shareToken`)
- Transferring trip ownership

---

## Data Model

### `TripShare` (existing — minor update)

Formalize `role` as a string enum `"editor" | "viewer"` (currently defaults to `"viewer"`). No migration needed beyond ensuring all existing records have a valid role.

```prisma
model TripShare {
  id     String @id @default(cuid())
  tripId String
  userId String
  role   String @default("viewer")  // "editor" | "viewer"
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([tripId, userId])
}
```

### `TripInvite` (new)

Stores pending invitations for people who haven't signed in yet. Resolved at login via NextAuth callback.

```prisma
model TripInvite {
  id           String   @id @default(cuid())
  tripId       String
  invitedEmail String
  role         String   @default("viewer")  // "editor" | "viewer"
  invitedBy    String   // userId of the trip owner
  createdAt    DateTime @default(now())
  trip         Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  inviter      User     @relation("SentInvites", fields: [invitedBy], references: [id])
  @@unique([tripId, invitedEmail])
}
```

The `User` model must also add the back-relation:
```prisma
// Add to User model in schema.prisma:
sentInvites TripInvite[] @relation("SentInvites")
```

### `FamilyProfile` (existing — make `userId` optional, add back-relation)

A `FamilyProfile` is either:
- **User-owned**: `userId` is set — the user's personal default profile. Cascades delete when user is deleted.
- **Trip-owned**: `userId` is null, referenced by `Trip.familyProfileId`. Cascades delete when trip is deleted (via `Trip.familyProfileId` FK).

```prisma
model FamilyProfile {
  id      String  @id @default(cuid())
  userId  String? @unique
  user    User?   @relation(fields: [userId], references: [id], onDelete: Cascade)
  trip    Trip?   // back-relation; required by Prisma for the Trip.familyProfileId FK
  members FamilyMember[]
  // ...existing preference fields unchanged...
}
```

Making `userId` nullable is a safe DDL change — existing rows retain their values.

### `Trip` (existing — add `familyProfileId` and `invites`)

```prisma
model Trip {
  // ...existing fields...
  familyProfileId String?        @unique
  familyProfile   FamilyProfile? @relation(fields: [familyProfileId], references: [id])
  invites         TripInvite[]
}
```

---

## API

### Trips List

**`GET /api/trips`** — **modified route** (currently owner-only; extended to include shared trips)

Returns owned trips **and** trips shared with the current user via `TripShare`. Response shape changes — frontend must be updated to handle new fields.

```ts
type TripListItem = {
  id: string
  name: string
  destination: string
  startDate: string | null
  endDate: string | null
  isShared: boolean           // true if current user is not the owner
  role: "owner" | "editor" | "viewer"
  members: { name: string | null; image: string | null }[]  // collaborator avatars (populated for owned shared trips)
}
```

### Member Management

File-system layout (to avoid Next.js App Router dynamic segment conflicts):
```
src/app/api/trips/[tripId]/members/
  route.ts                      → GET, POST
  [userId]/
    route.ts                    → PUT, DELETE (member by userId)
  invites/
    [inviteId]/
      route.ts                  → DELETE (cancel pending invite)
```

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/trips/[tripId]/members` | owner or editor | List `TripShare` records + pending `TripInvite` records |
| `POST` | `/api/trips/[tripId]/members` | owner only | Invite by email: creates `TripShare` if user with that email exists, else `TripInvite` |
| `PUT` | `/api/trips/[tripId]/members/[userId]` | owner only | Change a member's role |
| `DELETE` | `/api/trips/[tripId]/members/[userId]` | owner (others) or self | Remove a member; any non-owner can pass their own `userId` to leave |
| `DELETE` | `/api/trips/[tripId]/members/invites/[inviteId]` | owner only | Cancel a pending invite |

### Trip Family Profile

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/trips/[tripId]/profile` | any access | Return the trip's `FamilyProfile` (null if not set) |
| `POST` | `/api/trips/[tripId]/profile` | editor or owner | Create trip profile; accepts optional `{ seedFromDefault: true }` to copy the caller's default profile |
| `PUT` | `/api/trips/[tripId]/profile` | editor or owner | Update profile preferences |

Family members within the trip profile follow the existing `FamilyMember` CRUD pattern (add/edit/delete records linked to this profile's `id`).

---

## Access Control

### Role Table

| Action | Owner | Editor | Viewer |
|--------|-------|--------|--------|
| View trip | ✓ | ✓ | ✓ |
| Edit trip metadata (name, dates, destination, accommodation, flights, car rental) | ✓ | ✓ | ✗ |
| Edit attractions, schedule, restaurants, grocery | ✓ | ✓ | ✗ |
| Execute AI chat actions (`/api/ai/chat/execute`) | ✓ | ✓ | ✗ |
| Edit trip family profile | ✓ | ✓ | ✗ |
| View members list | ✓ | ✓ | ✗ |
| Invite / remove others, change roles | ✓ | ✗ | ✗ |
| Delete trip | ✓ | ✗ | ✗ |
| Leave trip | n/a | ✓ | ✓ |

### `requireTripAccess` update

Update `src/lib/trip-access.ts` to return `{ session, trip, role: "owner" | "editor" | "viewer" }`.

All existing write routes (attractions, restaurants, schedule, grocery, AI execute, trip metadata `PUT`) add:
```ts
if (role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
```

Member management routes check `role === "owner"`, except `DELETE` with `userId === session.user.id` (self-removal, allowed for any role).

### AI Chat — Viewer Suppression

- `POST /api/ai/chat/execute` must call `requireTripAccess` and enforce `role !== "viewer"`
- The role must be passed to the frontend AI chat component so the "approve action" button is hidden for viewers

### NextAuth sign-in callback

In `src/lib/auth.ts`, invite resolution runs **after** the existing `ALLOWED_EMAILS` allowlist check passes (i.e., only when the callback would return `true`). Order:

```ts
async signIn({ user }) {
  // 1. Existing allowlist check — return false if blocked
  if (process.env.ALLOWED_EMAILS && !allowedEmails.includes(user.email)) return false

  // 2. Resolve pending invites (only reaches here if user is allowed)
  if (user.email && user.id) {
    const pending = await prisma.tripInvite.findMany({ where: { invitedEmail: user.email } })
    if (pending.length > 0) {
      await prisma.$transaction([
        prisma.tripShare.createMany({
          data: pending.map(inv => ({ tripId: inv.tripId, userId: user.id!, role: inv.role })),
          skipDuplicates: true,
        }),
        prisma.tripInvite.deleteMany({ where: { invitedEmail: user.email } }),
      ])
    }
  }

  return true
}
```

Google OAuth always provides a verified email, so `user.email` matching is reliable.

---

## UI

### Trips List (`src/app/trips/page.tsx`)

- Trips owned by the user that have shares: show "משותף" purple badge + row of collaborator avatar initials
- Trips shared with the user (not owner): show "שיתפו איתי" green badge, slightly different background
- Unshared trips: no badge (current behavior)

### Trip Dashboard — Sharing Panel

Extend the existing share UI in `src/components/trips/ShareExportButtons.tsx` (or extract to a new `TripMembersPanel` component) to include a **Members** section alongside the existing public share link:

- Email input + role dropdown (עורך / צופה) + "הזמן" button
- Member list: avatar initials, name, email, role dropdown (owner can change), remove button (✕)
- Pending invites: dashed border, email, "ממתין להצטרפות · [role]", cancel button
- Owner badge displayed but not editable
- For editors (non-owner): see members list read-only (no invite/remove controls)
- For viewers: members panel not shown

### Trip Dashboard — Family Profile Tab

Add a "פרופיל משפחה" tab to `src/components/trips/TripDashboard.tsx`:

- **Empty state**: "צור פרופיל לטיול" (blank) and "ייבא מברירת המחדל" (copies owner's default) buttons
- **Populated state**: member list + preferences, same editor UI as the existing default profile page
- Editors can add/edit/remove family members and update preferences
- Viewers see the profile read-only (no edit controls)

### Viewer Read-Only Enforcement

When `role === "viewer"`:
- Hide add/edit/delete buttons across all tabs (attractions, restaurants, schedule, grocery, profile)
- Show a subtle "צפייה בלבד" indicator in the trip header
- Hide AI chat "approve action" button
- Members panel not shown

### Leave Trip

On shared trips (non-owner), show a "עזוב טיול" button in the trip header or settings area. Calls `DELETE /api/trips/[tripId]/members/[currentUserId]`. Redirect to trips list on success.

---

## Known Limitations

- **No email notification**: Invitees are not emailed. The owner must tell them to open the app and sign in. Pending invites are matched automatically on their first login.
- **No conflict resolution**: If two editors edit simultaneously, last write wins (existing behavior).
- **Owner cannot be demoted**: Trip ownership is not transferable in this version.
