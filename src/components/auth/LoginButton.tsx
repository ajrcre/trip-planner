"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import Image from "next/image"

export function LoginButton() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
    )
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? ""}
            width={32}
            height={32}
            className="rounded-full"
          />
        )}
        <span className="text-sm font-medium">{session.user.name}</span>
        <button
          onClick={() => signOut()}
          className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          התנתק
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => signIn("google")}
      className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
    >
      התחבר עם Google
    </button>
  )
}
