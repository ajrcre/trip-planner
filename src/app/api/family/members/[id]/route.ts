import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function verifyMemberOwnership(memberId: string, userId: string) {
  const member = await prisma.familyMember.findUnique({
    where: { id: memberId },
    include: { familyProfile: true },
  })

  if (!member || member.familyProfile.userId !== userId) {
    return null
  }

  return member
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const member = await verifyMemberOwnership(id, session.user.id)
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json()
  const { name, dateOfBirth, role, specialNeeds } = body

  const updated = await prisma.familyMember.update({
    where: { id },
    data: {
      name,
      dateOfBirth: new Date(dateOfBirth),
      role,
      specialNeeds: specialNeeds || [],
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const member = await verifyMemberOwnership(id, session.user.id)
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.familyMember.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
