"use client"

import { useState } from "react"

interface AiAssistantProps {
  tripId: string
}

const QUICK_QUESTIONS = [
  "מה מתאים לאחר הצהריים?",
  "אטרקציות לילדים קטנים",
  "מה לעשות ביום גשום?",
]

export function AiAssistant({ tripId }: AiAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleAsk(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return

    setIsLoading(true)
    setAnswer("")
    setError("")
    setQuestion("")

    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, question: trimmed }),
      })

      if (!res.ok) {
        throw new Error("Failed to get suggestion")
      }

      const data = await res.json()
      setAnswer(data.answer)
    } catch {
      setError("שגיאה בקבלת תשובה. נסו שוב.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <span className="text-lg" aria-hidden="true">
          {"\u{1F4A1}"}
        </span>
        {"שאל את Claude"}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            {"\u{1F4A1}"}
          </span>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {"עוזר AI לתכנון הטיול"}
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          aria-label="סגור"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        {/* Quick questions */}
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleAsk(q)}
              disabled={isLoading}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLoading) {
                handleAsk(question)
              }
            }}
            placeholder="שאלו על הטיול..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-400"
            dir="rtl"
          />
          <button
            onClick={() => handleAsk(question)}
            disabled={isLoading || !question.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              "שלח"
            )}
          </button>
        </div>

        {/* Answer */}
        {answer && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                AI
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {"תשובת Claude"}
              </span>
            </div>
            <div
              className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
              dir="rtl"
            >
              {answer}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
