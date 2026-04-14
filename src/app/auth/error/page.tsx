import Link from "next/link"

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">אין גישה</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          החשבון שלך לא מורשה לגשת לאפליקציה הזו. אם אתה חושב שזו טעות, פנה
          למנהל המערכת.
        </p>
        <Link
          href="/api/auth/signin"
          className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 transition-colors"
        >
          נסה שוב
        </Link>
      </div>
    </div>
  )
}
