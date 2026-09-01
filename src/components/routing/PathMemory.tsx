"use client"

import { Suspense, useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"

import { rememberPath } from "@/lib/last-path"

function PathRecorder() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { status } = useSession()

  useEffect(() => {
    if (status !== "authenticated") return
    const query = searchParams.toString()
    rememberPath(query ? `${pathname}?${query}` : pathname)
  }, [pathname, searchParams, status])

  return null
}

/**
 * Records the current in-app location on every navigation so `/open` can resume
 * it after a cold start.
 *
 * `useSearchParams` opts its subtree into client rendering, so it is isolated
 * behind Suspense here rather than de-optimising every page under the root
 * layout.
 */
export function PathMemory() {
  return (
    <Suspense fallback={null}>
      <PathRecorder />
    </Suspense>
  )
}
