import { NextAuthOptions, getServerSession, Session } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"

/**
 * Get the current session, with optional dev bypass.
 * Set BYPASS_AUTH=true in .env to skip Google login locally.
 * Uses the first user in the DB as the dev user.
 */
export async function getAuthSession(): Promise<Session | null> {
  if (process.env.BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production") {
    const user = await prisma.user.findFirst({
      select: { id: true, name: true, email: true, image: true },
    })
    if (!user) return null
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as Session
  }
  return getServerSession(authOptions)
}

function getAllowedEmails(): string[] | null {
  const raw = process.env.ALLOWED_EMAILS
  if (!raw) return null
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn: async ({ user }) => {
      const allowed = getAllowedEmails()
      if (!allowed) return true
      return allowed.includes(user.email?.toLowerCase() ?? "")
    },
    session: async ({ session, user }) => {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
  },
  pages: {
    error: "/auth/error",
  },
}
