# Trip Sharing & Family Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to share trips with invited collaborators by email, with role-based access (owner / editor / viewer), a trip-level family profile, and a pending-invite system resolved automatically at login.

**Architecture:** Schema adds `TripInvite` (pending invites) and makes `FamilyProfile` optionally trip-scoped. `requireTripAccess` is extended to return the caller's role, which all write routes and the UI use to gate mutations. The NextAuth `signIn` callback resolves pending invites by email on every login.

**Tech Stack:** Prisma 7 + PostgreSQL (Neon), Next.js 16 App Router, React 19, TypeScript strict, NextAuth.js 4, Tailwind CSS 4, Jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-04-14-trip-sharing-design.md`

---

## File Map

### Modified files
- `prisma/schema.prisma` — add `TripInvite`, update `FamilyProfile`, `Trip`, `User`
- `src/lib/trip-access.ts` — return `role` from `requireTripAccess`
- `src/lib/auth.ts` — add invite resolution to `signIn` callback
- `src/app/api/trips/route.ts` — include shared trips in GET response
- `src/app/api/trips/[tripId]/route.ts` — enforce editor role on PUT
- `src/app/api/trips/[tripId]/attractions/route.ts` — enforce editor role on POST
- `src/app/api/trips/[tripId]/attractions/[id]/route.ts` — enforce editor role on PUT/DELETE
- `src/app/api/trips/[tripId]/restaurants/route.ts` — enforce editor role
- `src/app/api/trips/[tripId]/restaurants/[id]/route.ts` — enforce editor role
- `src/app/api/trips/[tripId]/grocery-stores/route.ts` — enforce editor role
- `src/app/api/trips/[tripId]/grocery-stores/[id]/route.ts` — enforce editor role
- `src/app/api/trips/[tripId]/schedule/route.ts` — enforce editor role
- `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts` — enforce editor role
- `src/app/api/trips/[tripId]/packing/route.ts` — enforce editor role
- `src/app/api/trips/[tripId]/shopping/route.ts` — enforce editor role
- `src/app/api/ai/chat/execute/route.ts` — enforce editor role
- `src/app/trips/page.tsx` — show shared/owner badges + avatars
- `src/components/trips/TripDashboard.tsx` — add `role` prop, family profile tab, leave trip button
- `src/components/trips/ShareExportButtons.tsx` — add members panel (invite, list, pending)

### New files
- `src/app/api/trips/[tripId]/members/route.ts` — GET list, POST invite
- `src/app/api/trips/[tripId]/members/[userId]/route.ts` — PUT role, DELETE remove/leave
- `src/app/api/trips/[tripId]/members/invites/[inviteId]/route.ts` — DELETE cancel invite
- `src/app/api/trips/[tripId]/profile/route.ts` — GET/POST/PUT trip family profile
- `src/components/trips/tabs/FamilyProfileTab.tsx` — new tab for trip-level family profile
- `src/types/sharing.ts` — shared TypeScript types
- `src/lib/__tests__/trip-access.test.ts` — tests for role extraction
- `src/lib/__tests__/trip-sharing.test.ts` — tests for invite resolution

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update `prisma/schema.prisma`**

  Make the following changes:

  **Add `sentInvites` back-relation to `User` model (after `sharedTrips`):**
  ```prisma
  sentInvites   TripInvite[]  @relation("SentInvites")
  ```

  **Update `FamilyProfile` — make `userId` optional, add `trip` back-relation, keep `onDelete: Cascade`:**
  ```prisma
  model FamilyProfile {
    id     String  @id @default(cuid())
    userId String? @unique
    user   User?   @relation(fields: [userId], references: [id], onDelete: Cascade)
    trip   Trip?

    attractionTypes          String[]  @default([])
    foodPreferences          String[]  @default([])
    noLayovers               Boolean   @default(true)
    preferredFlightStart     String?
    preferredFlightEnd       String?
    pace                     String    @default("moderate")
    preFlightArrivalMinutes  Int       @default(180)
    carPickupDurationMinutes Int       @default(120)
    carReturnDurationMinutes Int       @default(60)

    members FamilyMember[]

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
  }
  ```

  **Add `familyProfileId` and `invites` to `Trip` model (after `shares`):**
  ```prisma
  familyProfileId String?        @unique
  familyProfile   FamilyProfile? @relation(fields: [familyProfileId], references: [id])
  invites         TripInvite[]
  ```

  **Add `TripInvite` model (after `TripShare`):**
  ```prisma
  model TripInvite {
    id           String   @id @default(cuid())
    tripId       String
    invitedEmail String
    role         String   @default("viewer")
    invitedBy    String
    createdAt    DateTime @default(now())
    trip         Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
    inviter      User     @relation("SentInvites", fields: [invitedBy], references: [id])

    @@unique([tripId, invitedEmail])
  }
  ```

- [ ] **Step 2: Run migration**

  ```bash
  npx prisma migrate dev --name add-trip-sharing
  ```

  Expected: Migration created and applied, no errors.

- [ ] **Step 3: Regenerate Prisma client**

  ```bash
  npx prisma generate
  ```

  Expected: `src/generated/prisma` regenerated with new types.

- [ ] **Step 4: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations
  git commit -m "feat: add TripInvite model and trip-level FamilyProfile to schema"
  ```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types/sharing.ts`

- [ ] **Step 1: Create `src/types/sharing.ts`**

  ```typescript
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
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/types/sharing.ts
  git commit -m "feat: add shared TypeScript types for trip sharing"
  ```

---

## Task 3: Update `requireTripAccess` to return role

**Files:**
- Modify: `src/lib/trip-access.ts`
- Create: `src/lib/__tests__/trip-access.test.ts`

- [ ] **Step 1: Write failing tests**

  Create `src/lib/__tests__/trip-access.test.ts`:

  ```typescript
  import { verifyTripAccess } from "../trip-access"
  import { prisma } from "../prisma"

  jest.mock("../prisma", () => ({
    prisma: {
      trip: {
        findUnique: jest.fn(),
      },
    },
  }))

  const mockFindUnique = prisma.trip.findUnique as jest.MockedFunction<
    typeof prisma.trip.findUnique
  >

  const baseTrip = {
    id: "trip1",
    userId: "owner1",
    shares: [],
    name: "Test",
    destination: "Paris",
    startDate: new Date(),
    endDate: new Date(),
    shareToken: null,
    accommodation: null,
    flights: null,
    carRental: null,
    destinationInfo: null,
    familyProfileId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe("verifyTripAccess", () => {
    it("returns role owner for trip owner", async () => {
      mockFindUnique.mockResolvedValueOnce(baseTrip as any)
      const result = await verifyTripAccess("trip1", "owner1")
      expect(result).not.toBeNull()
      expect(result?.role).toBe("owner")
    })

    it("returns role editor for shared editor", async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...baseTrip,
        shares: [{ userId: "user2", role: "editor" }],
      } as any)
      const result = await verifyTripAccess("trip1", "user2")
      expect(result?.role).toBe("editor")
    })

    it("returns role viewer for shared viewer", async () => {
      mockFindUnique.mockResolvedValueOnce({
        ...baseTrip,
        shares: [{ userId: "user3", role: "viewer" }],
      } as any)
      const result = await verifyTripAccess("trip1", "user3")
      expect(result?.role).toBe("viewer")
    })

    it("returns null for unauthorized user", async () => {
      mockFindUnique.mockResolvedValueOnce(baseTrip as any)
      const result = await verifyTripAccess("trip1", "stranger")
      expect(result).toBeNull()
    })
  })
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  npx jest --testPathPattern=trip-access
  ```

  Expected: FAIL — `result.role` is `undefined`.

- [ ] **Step 3: Update `src/lib/trip-access.ts`**

  Replace the entire file:

  ```typescript
  import { NextResponse } from "next/server"
  import type { Session } from "next-auth"
  import type { Trip, TripShare } from "@/generated/prisma/client"

  import { getAuthSession } from "@/lib/auth"
  import { prisma } from "@/lib/prisma"
  import type { TripRole } from "@/types/sharing"

  export type TripAccessResult = {
    trip: Trip & { shares: TripShare[] }
    role: TripRole
  }

  export async function verifyTripAccess(
    tripId: string,
    userId: string
  ): Promise<TripAccessResult | null> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { shares: true },
    })

    if (!trip) return null

    if (trip.userId === userId) {
      return { trip, role: "owner" }
    }

    const share = trip.shares.find((s) => s.userId === userId)
    if (share) {
      return { trip, role: share.role as "editor" | "viewer" }
    }

    return null
  }

  export async function requireTripAccess(tripId: string): Promise<
    | { session: Session; trip: Trip & { shares: TripShare[] }; role: TripRole }
    | NextResponse
  > {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await verifyTripAccess(tripId, session.user.id)
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return { session, trip: result.trip, role: result.role }
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  ```bash
  npx jest --testPathPattern=trip-access
  ```

  Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/trip-access.ts src/lib/__tests__/trip-access.test.ts
  git commit -m "feat: requireTripAccess now returns role (owner/editor/viewer)"
  ```

---

## Task 4: Update `GET /api/trips` to include shared trips

**Files:**
- Modify: `src/app/api/trips/route.ts`

- [ ] **Step 1: Update `src/app/api/trips/route.ts` GET handler**

  Replace the GET function:

  ```typescript
  export async function GET() {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Own trips
    const ownTrips = await prisma.trip.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        destination: true,
        startDate: true,
        endDate: true,
        shares: {
          include: { user: { select: { name: true, image: true } } },
        },
      },
      orderBy: { startDate: "desc" },
    })

    // Shared trips (where current user is a collaborator)
    const sharedTripShares = await prisma.tripShare.findMany({
      where: { userId },
      include: {
        trip: {
          select: {
            id: true,
            name: true,
            destination: true,
            startDate: true,
            endDate: true,
            shares: {
              include: { user: { select: { name: true, image: true } } },
            },
          },
        },
      },
    })

    const ownTripItems: TripListItem[] = ownTrips.map((t) => ({
      id: t.id,
      name: t.name,
      destination: t.destination,
      startDate: t.startDate?.toISOString() ?? null,
      endDate: t.endDate?.toISOString() ?? null,
      isShared: t.shares.length > 0,
      role: "owner" as const,
      members: t.shares.map((s) => ({ name: s.user.name, image: s.user.image })),
    }))

    const sharedTripItems: TripListItem[] = sharedTripShares.map((s) => ({
      id: s.trip.id,
      name: s.trip.name,
      destination: s.trip.destination,
      startDate: s.trip.startDate?.toISOString() ?? null,
      endDate: s.trip.endDate?.toISOString() ?? null,
      isShared: true,
      role: s.role as "editor" | "viewer",
      members: [],
    }))

    // Merge, sort by startDate descending, deduplicate by id
    const all = [...ownTripItems, ...sharedTripItems].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )

    return NextResponse.json(all)
  }
  ```

  Add the import at the top of the file:
  ```typescript
  import type { TripListItem } from "@/types/sharing"
  ```

- [ ] **Step 2: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/api/trips/route.ts
  git commit -m "feat: GET /api/trips returns owned and shared trips with role"
  ```

---

## Task 5: Enforce editor role on all write routes

**Files (all write routes):**
- Modify: `src/app/api/trips/[tripId]/route.ts`
- Modify: `src/app/api/trips/[tripId]/attractions/route.ts`
- Modify: `src/app/api/trips/[tripId]/attractions/[id]/route.ts`
- Modify: `src/app/api/trips/[tripId]/restaurants/route.ts`
- Modify: `src/app/api/trips/[tripId]/restaurants/[id]/route.ts`
- Modify: `src/app/api/trips/[tripId]/grocery-stores/route.ts`
- Modify: `src/app/api/trips/[tripId]/grocery-stores/[id]/route.ts`
- Modify: `src/app/api/trips/[tripId]/schedule/route.ts`
- Modify: `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts`
- Modify: `src/app/api/trips/[tripId]/packing/route.ts`
- Modify: `src/app/api/trips/[tripId]/shopping/route.ts`
- Modify: `src/app/api/ai/chat/execute/route.ts`

The pattern is the same for every write handler (POST, PUT, DELETE, PATCH). After destructuring `requireTripAccess`, add a viewer guard:

```typescript
const result = await requireTripAccess(tripId)
if (result instanceof NextResponse) return result
const { session, trip, role } = result

// Add this guard to all write handlers (POST/PUT/DELETE):
if (role === "viewer") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

GET handlers don't need the guard — viewers can read.

The `DELETE /api/trips/[tripId]/route.ts` (delete whole trip) needs an additional owner check:
```typescript
if (role !== "owner") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

- [ ] **Step 1: Update `src/app/api/trips/[tripId]/route.ts`**

  Add viewer guard to PUT. Add owner-only guard to DELETE.

- [ ] **Step 2: Update attractions, restaurants, grocery-stores routes**

  For each: `attractions/route.ts`, `attractions/[id]/route.ts`, `restaurants/route.ts`, `restaurants/[id]/route.ts`, `grocery-stores/route.ts`, `grocery-stores/[id]/route.ts` — add `if (role === "viewer") return 403` to all write handlers.

- [ ] **Step 3: Update schedule, packing, shopping routes**

  Same pattern for `schedule/route.ts`, `schedule/[dayId]/route.ts`, `packing/route.ts`, `shopping/route.ts`.

- [ ] **Step 4: Update AI execute route**

  In `src/app/api/ai/chat/execute/route.ts`, the route currently calls `requireTripAccess`. Add the viewer guard immediately after:

  ```typescript
  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result
  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  ```

- [ ] **Step 5: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/api/trips src/app/api/ai
  git commit -m "feat: enforce editor/owner role on all trip write routes"
  ```

---

## Task 6: Member management API

**Files:**
- Create: `src/app/api/trips/[tripId]/members/route.ts`
- Create: `src/app/api/trips/[tripId]/members/[userId]/route.ts`
- Create: `src/app/api/trips/[tripId]/members/invites/[inviteId]/route.ts`

- [ ] **Step 1: Create `src/app/api/trips/[tripId]/members/route.ts`**

  ```typescript
  import { NextResponse } from "next/server"
  import { requireTripAccess } from "@/lib/trip-access"
  import { prisma } from "@/lib/prisma"

  // GET /api/trips/[tripId]/members
  // Returns current members + pending invites. Requires editor or owner.
  export async function GET(
    _req: Request,
    { params }: { params: Promise<{ tripId: string }> }
  ) {
    const { tripId } = await params
    const result = await requireTripAccess(tripId)
    if (result instanceof NextResponse) return result
    const { role } = result

    if (role === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [shares, invites, trip] = await Promise.all([
      prisma.tripShare.findMany({
        where: { tripId },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      }),
      prisma.tripInvite.findMany({
        where: { tripId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.trip.findUnique({ where: { id: tripId }, select: { userId: true, user: { select: { id: true, name: true, email: true, image: true } } } }),
    ])

    return NextResponse.json({
      owner: trip?.user,
      members: shares.map((s) => ({
        userId: s.user.id,
        name: s.user.name,
        email: s.user.email,
        image: s.user.image,
        role: s.role,
      })),
      pendingInvites: invites.map((i) => ({
        id: i.id,
        invitedEmail: i.invitedEmail,
        role: i.role,
        createdAt: i.createdAt.toISOString(),
      })),
    })
  }

  // POST /api/trips/[tripId]/members
  // Invite by email. Owner only.
  export async function POST(
    req: Request,
    { params }: { params: Promise<{ tripId: string }> }
  ) {
    const { tripId } = await params
    const result = await requireTripAccess(tripId)
    if (result instanceof NextResponse) return result
    const { session, role } = result

    if (role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { email, inviteRole = "viewer" } = body as { email: string; inviteRole?: string }

    if (!email || !["editor", "viewer"].includes(inviteRole)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      // Don't share with the owner themselves
      if (existingUser.id === session.user.id) {
        return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 })
      }
      // Create TripShare immediately
      const share = await prisma.tripShare.upsert({
        where: { tripId_userId: { tripId, userId: existingUser.id } },
        update: { role: inviteRole },
        create: { tripId, userId: existingUser.id, role: inviteRole },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      })
      return NextResponse.json({ type: "added", member: { userId: share.user.id, name: share.user.name, email: share.user.email, image: share.user.image, role: share.role } }, { status: 201 })
    }

    // User doesn't exist yet — create pending invite
    const invite = await prisma.tripInvite.upsert({
      where: { tripId_invitedEmail: { tripId, invitedEmail: normalizedEmail } },
      update: { role: inviteRole },
      create: { tripId, invitedEmail: normalizedEmail, role: inviteRole, invitedBy: session.user.id },
    })
    return NextResponse.json({ type: "pending", invite: { id: invite.id, invitedEmail: invite.invitedEmail, role: invite.role, createdAt: invite.createdAt.toISOString() } }, { status: 201 })
  }
  ```

- [ ] **Step 2: Create `src/app/api/trips/[tripId]/members/[userId]/route.ts`**

  ```typescript
  import { NextResponse } from "next/server"
  import { requireTripAccess } from "@/lib/trip-access"
  import { prisma } from "@/lib/prisma"

  // PUT /api/trips/[tripId]/members/[userId] — change role. Owner only.
  export async function PUT(
    req: Request,
    { params }: { params: Promise<{ tripId: string; userId: string }> }
  ) {
    const { tripId, userId } = await params
    const result = await requireTripAccess(tripId)
    if (result instanceof NextResponse) return result
    const { role } = result

    if (role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { newRole } = body as { newRole: string }

    if (!["editor", "viewer"].includes(newRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const share = await prisma.tripShare.update({
      where: { tripId_userId: { tripId, userId } },
      data: { role: newRole },
    })

    return NextResponse.json({ role: share.role })
  }

  // DELETE /api/trips/[tripId]/members/[userId]
  // Owner can remove anyone. Non-owners can remove themselves (leave trip).
  export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ tripId: string; userId: string }> }
  ) {
    const { tripId, userId } = await params
    const result = await requireTripAccess(tripId)
    if (result instanceof NextResponse) return result
    const { session, role } = result

    const isSelf = session.user.id === userId
    if (!isSelf && role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.tripShare.delete({
      where: { tripId_userId: { tripId, userId } },
    })

    return NextResponse.json({ ok: true })
  }
  ```

- [ ] **Step 3: Create `src/app/api/trips/[tripId]/members/invites/[inviteId]/route.ts`**

  ```typescript
  import { NextResponse } from "next/server"
  import { requireTripAccess } from "@/lib/trip-access"
  import { prisma } from "@/lib/prisma"

  // DELETE /api/trips/[tripId]/members/invites/[inviteId] — cancel pending invite. Owner only.
  export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ tripId: string; inviteId: string }> }
  ) {
    const { tripId, inviteId } = await params
    const result = await requireTripAccess(tripId)
    if (result instanceof NextResponse) return result
    const { role } = result

    if (role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.tripInvite.delete({ where: { id: inviteId } })

    return NextResponse.json({ ok: true })
  }
  ```

- [ ] **Step 4: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 5: Commit**

  ```bash
  git add "src/app/api/trips/[tripId]/members"
  git commit -m "feat: add member management API (invite, list, change role, remove, cancel invite)"
  ```

---

## Task 7: NextAuth sign-in callback — resolve pending invites

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/lib/__tests__/trip-sharing.test.ts`

- [ ] **Step 1: Write failing test**

  Create `src/lib/__tests__/trip-sharing.test.ts`:

  ```typescript
  import { prisma } from "../prisma"

  jest.mock("../prisma", () => ({
    prisma: {
      tripInvite: {
        findMany: jest.fn(),
      },
      tripShare: {
        createMany: jest.fn(),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    },
  }))

  // Extract the invite resolution logic so it can be tested independently
  import { resolveInvitesForUser } from "../auth"

  describe("resolveInvitesForUser", () => {
    it("creates TripShare records and deletes invites for matching email", async () => {
      const mockInvites = [
        { id: "inv1", tripId: "trip1", role: "editor", invitedEmail: "test@example.com" },
      ]
      ;(prisma.tripInvite.findMany as jest.Mock).mockResolvedValueOnce(mockInvites)
      ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([])

      await resolveInvitesForUser({ email: "test@example.com", id: "user1" })

      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it("does nothing if no pending invites", async () => {
      ;(prisma.tripInvite.findMany as jest.Mock).mockResolvedValueOnce([])

      await resolveInvitesForUser({ email: "test@example.com", id: "user1" })

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  npx jest --testPathPattern=trip-sharing
  ```

  Expected: FAIL — `resolveInvitesForUser` is not exported.

- [ ] **Step 3: Update `src/lib/auth.ts`**

  Export a `resolveInvitesForUser` helper and call it from the `signIn` callback. Replace the `signIn` callback and add the helper:

  ```typescript
  export async function resolveInvitesForUser(user: { email: string | null | undefined; id: string | null | undefined }) {
    if (!user.email || !user.id) return
    const pending = await prisma.tripInvite.findMany({
      where: { invitedEmail: user.email.toLowerCase() },
    })
    if (pending.length === 0) return
    await prisma.$transaction([
      prisma.tripShare.createMany({
        data: pending.map((inv) => ({
          tripId: inv.tripId,
          userId: user.id!,
          role: inv.role,
        })),
        skipDuplicates: true,
      }),
      prisma.tripInvite.deleteMany({
        where: { invitedEmail: user.email.toLowerCase() },
      }),
    ])
  }
  ```

  Update the `signIn` callback in `authOptions`:

  ```typescript
  signIn: async ({ user }) => {
    // 1. Allowlist check (existing)
    const allowed = getAllowedEmails()
    if (allowed && !allowed.includes(user.email?.toLowerCase() ?? "")) return false

    // 2. Resolve pending invites (only runs if user is allowed)
    await resolveInvitesForUser(user)

    return true
  },
  ```

- [ ] **Step 4: Run test to verify it passes**

  ```bash
  npx jest --testPathPattern=trip-sharing
  ```

  Expected: Both tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/auth.ts src/lib/__tests__/trip-sharing.test.ts
  git commit -m "feat: resolve pending trip invites automatically on sign-in"
  ```

---

## Task 8: Trip profile API

**Files:**
- Create: `src/app/api/trips/[tripId]/profile/route.ts`

- [ ] **Step 1: Create `src/app/api/trips/[tripId]/profile/route.ts`**

  ```typescript
  import { NextResponse } from "next/server"
  import { requireTripAccess } from "@/lib/trip-access"
  import { prisma } from "@/lib/prisma"

  // GET — return trip's FamilyProfile (null if not set)
  export async function GET(
    _req: Request,
    { params }: { params: Promise<{ tripId: string }> }
  ) {
    const { tripId } = await params
    const result = await requireTripAccess(tripId)
    if (result instanceof NextResponse) return result

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { familyProfile: { include: { members: true } } },
    })

    return NextResponse.json(trip?.familyProfile ?? null)
  }

  // POST — create trip profile (optionally seeded from caller's default)
  export async function POST(
    req: Request,
    { params }: { params: Promise<{ tripId: string }> }
  ) {
    const { tripId } = await params
    const result = await requireTripAccess(tripId)
    if (result instanceof NextResponse) return result
    const { session, trip, role } = result

    if (role === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (trip.familyProfileId) {
      return NextResponse.json({ error: "Profile already exists" }, { status: 409 })
    }

    const body = await req.json().catch(() => ({}))
    const { seedFromDefault } = body as { seedFromDefault?: boolean }

    let profileData: Record<string, unknown> = {}

    if (seedFromDefault) {
      const defaultProfile = await prisma.familyProfile.findUnique({
        where: { userId: session.user.id },
        include: { members: true },
      })
      if (defaultProfile) {
        profileData = {
          attractionTypes: defaultProfile.attractionTypes,
          foodPreferences: defaultProfile.foodPreferences,
          noLayovers: defaultProfile.noLayovers,
          preferredFlightStart: defaultProfile.preferredFlightStart,
          preferredFlightEnd: defaultProfile.preferredFlightEnd,
          pace: defaultProfile.pace,
          preFlightArrivalMinutes: defaultProfile.preFlightArrivalMinutes,
          carPickupDurationMinutes: defaultProfile.carPickupDurationMinutes,
          carReturnDurationMinutes: defaultProfile.carReturnDurationMinutes,
          members: {
            create: defaultProfile.members.map((m) => ({
              name: m.name,
              dateOfBirth: m.dateOfBirth,
              role: m.role,
              specialNeeds: m.specialNeeds,
            })),
          },
        }
      }
    }

    const profile = await prisma.familyProfile.create({
      data: profileData,
      include: { members: true },
    })

    await prisma.trip.update({
      where: { id: tripId },
      data: { familyProfileId: profile.id },
    })

    return NextResponse.json(profile, { status: 201 })
  }

  // PUT — update trip profile preferences
  export async function PUT(
    req: Request,
    { params }: { params: Promise<{ tripId: string }> }
  ) {
    const { tripId } = await params
    const result = await requireTripAccess(tripId)
    if (result instanceof NextResponse) return result
    const { trip, role } = result

    if (role === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!trip.familyProfileId) {
      return NextResponse.json({ error: "No profile" }, { status: 404 })
    }

    const body = await req.json()
    const { attractionTypes, foodPreferences, noLayovers, preferredFlightStart, preferredFlightEnd, pace, preFlightArrivalMinutes, carPickupDurationMinutes, carReturnDurationMinutes } = body

    const profile = await prisma.familyProfile.update({
      where: { id: trip.familyProfileId },
      data: {
        ...(attractionTypes !== undefined && { attractionTypes }),
        ...(foodPreferences !== undefined && { foodPreferences }),
        ...(noLayovers !== undefined && { noLayovers }),
        ...(preferredFlightStart !== undefined && { preferredFlightStart }),
        ...(preferredFlightEnd !== undefined && { preferredFlightEnd }),
        ...(pace !== undefined && { pace }),
        ...(preFlightArrivalMinutes !== undefined && { preFlightArrivalMinutes }),
        ...(carPickupDurationMinutes !== undefined && { carPickupDurationMinutes }),
        ...(carReturnDurationMinutes !== undefined && { carReturnDurationMinutes }),
      },
      include: { members: true },
    })

    return NextResponse.json(profile)
  }
  ```

- [ ] **Step 2: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add "src/app/api/trips/[tripId]/profile"
  git commit -m "feat: add trip-level family profile API (GET/POST/PUT)"
  ```

---

## Task 9: Trips list UI — shared badges

**Files:**
- Modify: `src/app/trips/page.tsx`

- [ ] **Step 1: Update `src/app/trips/page.tsx`**

  Update the `TripSummary` interface to use `TripListItem`:

  ```typescript
  import type { TripListItem } from "@/types/sharing"
  ```

  Change `useState<TripSummary[]>` to `useState<TripListItem[]>`. Update the trip card to show badges and avatars:

  ```tsx
  {trips.map((trip) => (
    <Link
      key={trip.id}
      href={`/trips/${trip.id}`}
      className={`rounded-xl border p-6 shadow-sm transition-shadow hover:shadow-md ${
        trip.isShared && trip.role !== "owner"
          ? "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{trip.name}</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{trip.destination}</p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            {new Date(trip.startDate).toLocaleDateString("he-IL")} -{" "}
            {new Date(trip.endDate).toLocaleDateString("he-IL")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {trip.role === "owner" && trip.isShared && (
            <span className="whitespace-nowrap rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              משותף
            </span>
          )}
          {trip.role !== "owner" && (
            <span className="whitespace-nowrap rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
              שיתפו איתי
            </span>
          )}
          {trip.role === "owner" && trip.members.length > 0 && (
            <div className="flex">
              {trip.members.slice(0, 4).map((m, i) => (
                <div
                  key={i}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-indigo-500 text-[10px] font-bold text-white dark:border-zinc-800"
                  style={{ marginRight: i > 0 ? "-6px" : "0", zIndex: trip.members.length - i }}
                  title={m.name ?? ""}
                >
                  {m.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  ))}
  ```

- [ ] **Step 2: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/trips/page.tsx
  git commit -m "feat: trips list shows shared/owner badges and collaborator avatars"
  ```

---

## Task 10: TripMembersPanel component

**Files:**
- Modify: `src/components/trips/ShareExportButtons.tsx`

- [ ] **Step 1: Update `src/components/trips/ShareExportButtons.tsx`**

  Add a `role` and `tripId` prop. Add a "משתתפים" button that opens a members panel below the existing share popover. The panel contains the invite form and member list from the design spec.

  Update the component signature:

  ```typescript
  import type { TripRole, TripMember, PendingInvite, TripMembersResponse } from "@/types/sharing"

  export function ShareExportButtons({
    tripId,
    tripName,
    role,
  }: {
    tripId: string
    tripName: string
    role: TripRole
  }) {
  ```

  Add state for the members panel:

  ```typescript
  const [showMembersPanel, setShowMembersPanel] = useState(false)
  const [members, setMembers] = useState<TripMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [owner, setOwner] = useState<{ id: string; name: string | null; image: string | null } | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor")
  const [inviteLoading, setInviteLoading] = useState(false)
  const membersPanelRef = useRef<HTMLDivElement>(null)
  ```

  Add a `loadMembers` function:

  ```typescript
  async function loadMembers() {
    const res = await fetch(`/api/trips/${tripId}/members`)
    if (res.ok) {
      const data: TripMembersResponse & { owner: typeof owner } = await res.json()
      setMembers(data.members)
      setPendingInvites(data.pendingInvites)
      setOwner(data.owner)
    }
  }
  ```

  Add `handleInvite`, `handleRemoveMember`, `handleCancelInvite`, `handleRoleChange` functions:

  ```typescript
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), inviteRole }),
      })
      if (res.ok) {
        setInviteEmail("")
        await loadMembers()
      }
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    await fetch(`/api/trips/${tripId}/members/${userId}`, { method: "DELETE" })
    await loadMembers()
  }

  async function handleCancelInvite(inviteId: string) {
    await fetch(`/api/trips/${tripId}/members/invites/${inviteId}`, { method: "DELETE" })
    await loadMembers()
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await fetch(`/api/trips/${tripId}/members/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newRole }),
    })
    await loadMembers()
  }
  ```

  Show the members button only if `role === "owner"` or `role === "editor"`. Load members when the panel opens.

  Add the panel JSX (a popover similar to the existing share popover) showing:
  - Invite form (owner only — hidden for editors)
  - Owner row (badge "בעלים", not editable)
  - Member rows with role dropdown + remove button (owner only) or read-only role (editor view)
  - Pending invite rows with cancel button (owner only)

- [ ] **Step 2: Update `TripDashboard.tsx` to pass `role` prop to `ShareExportButtons`**

  Change `TripDashboard` to accept `role: TripRole` as a prop and pass it through:

  ```typescript
  import type { TripRole } from "@/types/sharing"

  export function TripDashboard({ trip: initialTrip, role }: { trip: Trip; role: TripRole }) {
  ```

  Update the `ShareExportButtons` usage:
  ```tsx
  <ShareExportButtons tripId={trip.id} tripName={trip.name} role={role} />
  ```

- [ ] **Step 3: Update the trip page to pass `role` to `TripDashboard`**

  Find `src/app/trips/[tripId]/page.tsx`. Fetch the user's role from the trips list data or add it to the trip detail API response. The simplest approach: add `role` to the trip detail API (`GET /api/trips/[tripId]`) by using `requireTripAccess` and including `role` in the response JSON. Then pass it as a prop from the page.

  In `src/app/api/trips/[tripId]/route.ts` GET handler:
  ```typescript
  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result
  // ... existing fetch logic ...
  return NextResponse.json({ ...trip, role })
  ```

  In `src/app/trips/[tripId]/page.tsx`, read `role` from the fetched trip and pass it to `TripDashboard`:
  ```tsx
  <TripDashboard trip={tripData} role={tripData.role ?? "owner"} />
  ```

  Update the `Trip` interface in `TripDashboard.tsx` to include `role?: TripRole`.

- [ ] **Step 4: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/trips src/app/trips src/app/api/trips
  git commit -m "feat: add TripMembersPanel with invite, member list, and pending invites"
  ```

---

## Task 11: Family Profile Tab

**Files:**
- Create: `src/components/trips/tabs/FamilyProfileTab.tsx`
- Modify: `src/components/trips/TripDashboard.tsx`

- [ ] **Step 1: Create `src/components/trips/tabs/FamilyProfileTab.tsx`**

  ```typescript
  "use client"

  import { useState, useEffect } from "react"
  import type { TripRole } from "@/types/sharing"

  interface FamilyMember {
    id: string
    name: string
    role: string
    dateOfBirth: string
    specialNeeds: string[]
  }

  interface FamilyProfileData {
    id: string
    attractionTypes: string[]
    foodPreferences: string[]
    noLayovers: boolean
    pace: string
    members: FamilyMember[]
  }

  export function FamilyProfileTab({ tripId, role }: { tripId: string; role: TripRole }) {
    const [profile, setProfile] = useState<FamilyProfileData | null>(null)
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)

    const canEdit = role === "owner" || role === "editor"

    async function loadProfile() {
      const res = await fetch(`/api/trips/${tripId}/profile`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
      setLoading(false)
    }

    useEffect(() => { loadProfile() }, [tripId])

    async function handleCreate(seedFromDefault: boolean) {
      setCreating(true)
      const res = await fetch(`/api/trips/${tripId}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedFromDefault }),
      })
      if (res.ok) await loadProfile()
      setCreating(false)
    }

    if (loading) {
      return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>
    }

    if (!profile) {
      return (
        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-zinc-200 py-12 text-center dark:border-zinc-700">
          <div className="text-4xl">👨‍👩‍👧‍👦</div>
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">אין פרופיל משפחה לטיול זה</p>
            <p className="mt-1 text-sm text-zinc-500">ניתן ליצור פרופיל ייעודי לטיול זה</p>
          </div>
          {canEdit && (
            <div className="flex gap-3">
              <button
                onClick={() => handleCreate(false)}
                disabled={creating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "..." : "צור פרופיל לטיול"}
              </button>
              <button
                onClick={() => handleCreate(true)}
                disabled={creating}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
              >
                {creating ? "..." : "ייבא מברירת המחדל"}
              </button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">פרופיל משפחה לטיול</h2>
          {!canEdit && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 dark:bg-zinc-700">
              צפייה בלבד
            </span>
          )}
        </div>

        {/* Members list */}
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <h3 className="mb-3 font-medium">משתתפים ({profile.members.length})</h3>
          {profile.members.length === 0 ? (
            <p className="text-sm text-zinc-500">אין משתתפים</p>
          ) : (
            <div className="flex flex-col gap-2">
              {profile.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                  <div>
                    <span className="font-medium">{m.name}</span>
                    <span className="mr-2 text-sm text-zinc-500">{m.role}</span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {new Date(m.dateOfBirth).toLocaleDateString("he-IL")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preferences summary */}
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
          <h3 className="mb-3 font-medium">העדפות</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-zinc-500">קצב: </span>{profile.pace}</div>
            <div><span className="text-zinc-500">ללא עצירות: </span>{profile.noLayovers ? "כן" : "לא"}</div>
          </div>
        </div>
      </div>
    )
  }
  ```

  > **Note:** This implementation shows the profile read-only and handles create/seed. Full inline editing of members and preferences (add/edit/remove rows) follows the same patterns as the existing default profile page — look at how `FamilyMember` CRUD is done there and replicate it here for `canEdit` users. That detail is intentionally deferred to avoid duplicating code that already exists.

- [ ] **Step 2: Add `FamilyProfileTab` to `TripDashboard.tsx`**

  Import the new tab:
  ```typescript
  import { FamilyProfileTab } from "./tabs/FamilyProfileTab"
  ```

  Add to the `tabs` array:
  ```typescript
  { key: "familyProfile", label: "פרופיל משפחה" },
  ```

  Add tab render (alongside existing tabs):
  ```tsx
  {activeTab === "familyProfile" && <FamilyProfileTab tripId={trip.id} role={role} />}
  ```

- [ ] **Step 3: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/trips
  git commit -m "feat: add family profile tab for trip-level profile (create, seed from default, view)"
  ```

---

## Task 12: Viewer read-only enforcement + Leave trip

**Files:**
- Modify: `src/components/trips/TripDashboard.tsx`
- Modify: `src/components/trips/tabs/AttractionsTab.tsx`
- Modify: `src/components/trips/tabs/RestaurantsTab.tsx`
- Modify: `src/components/trips/tabs/GroceryStoresTab.tsx`
- Modify: `src/components/trips/tabs/ScheduleTab.tsx`
- Modify: `src/components/trips/tabs/ListsTab.tsx`

- [ ] **Step 1: Pass `role` to all tab components in `TripDashboard.tsx`**

  Update each tab render to include the `role` prop:

  ```tsx
  {activeTab === "attractions" && <AttractionsTab trip={trip} role={role} />}
  {activeTab === "restaurants" && <RestaurantsTab trip={trip} role={role} />}
  {activeTab === "groceryStores" && <GroceryStoresTab trip={trip} role={role} />}
  {activeTab === "schedule" && <ScheduleTab trip={trip} role={role} />}
  {activeTab === "lists" && <ListsTab tripId={trip.id} role={role} />}
  ```

  Also add the "צפייה בלבד" read-only indicator in the header when `role === "viewer"`:

  ```tsx
  {role === "viewer" && (
    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 dark:bg-zinc-700">
      צפייה בלבד
    </span>
  )}
  ```

  Add a "Leave trip" button for non-owners:

  ```tsx
  {role !== "owner" && (
    <button
      onClick={handleLeaveTrip}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      עזוב טיול
    </button>
  )}
  ```

  Add `handleLeaveTrip` to `TripDashboard`:

  ```typescript
  const router = useRouter() // import useRouter from next/navigation

  async function handleLeaveTrip() {
    if (!confirm("האם אתה בטוח שברצונך לעזוב את הטיול?")) return
    const res = await fetch(`/api/trips/${trip.id}/members/${session?.user?.id}`, {
      method: "DELETE",
    })
    if (res.ok) router.push("/trips")
  }
  ```

  Note: `session` needs to be available in `TripDashboard`. Since it's a client component, use `useSession()` from `next-auth/react`.

- [ ] **Step 2: Add `role` prop to each tab component**

  For each tab file (`AttractionsTab.tsx`, `RestaurantsTab.tsx`, `GroceryStoresTab.tsx`, `ScheduleTab.tsx`, `ListsTab.tsx`), add `role: TripRole` to the props type and use it to conditionally render add/edit/delete buttons. The pattern for each:

  ```typescript
  import type { TripRole } from "@/types/sharing"

  // In props:
  role: TripRole

  // Before any add/edit/delete button:
  {role !== "viewer" && (
    <button ...>הוסף</button>
  )}
  ```

  Read each tab file to find all mutation buttons and wrap them with `{role !== "viewer" && ...}`.

- [ ] **Step 3: Build check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: No errors.

- [ ] **Step 4: Run all tests**

  ```bash
  npx jest
  ```

  Expected: All tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/trips
  git commit -m "feat: viewer read-only enforcement across all tabs + leave trip button"
  ```

---

## Done

At this point:
- Schema is migrated with `TripInvite`, trip-level `FamilyProfile`, and updated `TripShare`
- `requireTripAccess` returns the caller's role
- All write routes reject viewers
- Trip owner can invite by email; pending invites resolve automatically on sign-in
- Trips list shows shared/owner status and collaborator avatars
- Members panel lets owner manage collaborators and pending invites
- Family profile tab per trip with seed-from-default option
- Viewers see all content read-only; non-owners can leave trips
