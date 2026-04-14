import { NextResponse } from "next/server"
import { requireTripAccess } from "@/lib/trip-access"
import { prisma } from "@/lib/prisma"

// GET — list members + pending invites. Requires editor or owner.
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
    prisma.trip.findUnique({
      where: { id: tripId },
      select: { user: { select: { id: true, name: true, email: true, image: true } } },
    }),
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

// POST — invite by email. Owner only.
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

  const normalizedEmail = email?.trim().toLowerCase() ?? ""
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)

  if (!emailValid || !["editor", "viewer"].includes(inviteRole)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existingUser) {
    if (existingUser.id === session.user.id) {
      return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 })
    }
    const share = await prisma.tripShare.upsert({
      where: { tripId_userId: { tripId, userId: existingUser.id } },
      update: { role: inviteRole },
      create: { tripId, userId: existingUser.id, role: inviteRole },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    })
    return NextResponse.json({
      type: "added",
      member: {
        userId: share.user.id,
        name: share.user.name,
        email: share.user.email,
        image: share.user.image,
        role: share.role,
      },
    }, { status: 201 })
  }

  // User doesn't exist yet — create pending invite
  const invite = await prisma.tripInvite.upsert({
    where: { tripId_invitedEmail: { tripId, invitedEmail: normalizedEmail } },
    update: { role: inviteRole },
    create: { tripId, invitedEmail: normalizedEmail, role: inviteRole, invitedBy: session.user.id },
  })
  return NextResponse.json({
    type: "pending",
    invite: {
      id: invite.id,
      invitedEmail: invite.invitedEmail,
      role: invite.role,
      createdAt: invite.createdAt.toISOString(),
    },
  }, { status: 201 })
}
