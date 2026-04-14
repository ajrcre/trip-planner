import { NextResponse } from "next/server"
import NextAuth from "next-auth"
import { authOptions, getAuthSession } from "@/lib/auth"

const nextAuthHandler = NextAuth(authOptions)

async function handleGET(req: Request) {
  // When BYPASS_AUTH is on and client requests the session, return the dev session
  if (
    process.env.BYPASS_AUTH === "true" &&
    new URL(req.url).pathname === "/api/auth/session"
  ) {
    const session = await getAuthSession()
    return NextResponse.json(session ?? {})
  }
  return nextAuthHandler(req as any, {} as any)
}

export { handleGET as GET, nextAuthHandler as POST }
