"use client"

import type { Session } from "next-auth"
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"

export function SessionProvider({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  return (
    <NextAuthSessionProvider
      session={session}
      // The session comes from the server on every render, and re-fetching it
      // on focus is a request the app cannot afford on a hotel connection —
      // every screen blocks on `useSession()`.
      refetchOnWindowFocus={false}
      refetchInterval={0}
    >
      {children}
    </NextAuthSessionProvider>
  )
}
