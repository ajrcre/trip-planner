import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth"

export default async function SharedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()
  if (!session?.user) {
    redirect("/api/auth/signin")
  }
  return <>{children}</>
}
