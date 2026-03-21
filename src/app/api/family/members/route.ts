import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let profile = await prisma.familyProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!profile) {
    profile = await prisma.familyProfile.create({
      data: { userId: session.user.id },
    })
  }

  const body = await request.json()
  const { name, dateOfBirth, role, specialNeeds } = body

  const member = await prisma.familyMember.create({
    data: {
      familyProfileId: profile.id,
      name,
      dateOfBirth: new Date(dateOfBirth),
      role,
      specialNeeds: specialNeeds || [],
    },
  })

  return NextResponse.json(member, { status: 201 })
}
