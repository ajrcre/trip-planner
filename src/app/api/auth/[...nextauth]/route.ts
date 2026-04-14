import { NextResponse } from "next/server"
import NextAuth from "next-auth"
import { authOptions, getAuthSession } from "@/lib/auth"

const handler = NextAuth(authOptions)

async function handleGET(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
  if (
    process.env.BYPASS_AUTH === "true" &&
    process.env.NODE_ENV !== "production" &&
    new URL(req.url).pathname === "/api/auth/session"
  ) {
    const session = await getAuthSession()
    return NextResponse.json(session ?? {})
  }
  return handler(req as any, ctx as any)
}

async function handlePOST(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
  return handler(req as any, ctx as any)
}

export { handleGET as GET, handlePOST as POST }
