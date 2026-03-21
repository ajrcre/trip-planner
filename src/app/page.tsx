import { getServerSession } from "next-auth"
import Link from "next/link"
import { authOptions } from "@/lib/auth"
import { LoginButton } from "@/components/auth/LoginButton"

export default async function Home() {
  const session = await getServerSession(authOptions)

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold">מתכנן טיולים</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          תכנון טיולים משפחתיים בקלות ובהנאה
        </p>

        {session?.user ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-xl">שלום {session.user.name}</p>
            <div className="flex gap-4">
              <Link
                href="/trips"
                className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                הטיולים שלי
              </Link>
              <Link
                href="/family"
                className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                המשפחה שלי
              </Link>
            </div>
            <LoginButton />
          </div>
        ) : (
          <LoginButton />
        )}
      </main>
    </div>
  )
}
