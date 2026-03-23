"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ChatMessage as ChatMessageType } from "@/types/ai-chat"
import type { ChatResponse, ExecuteActionResponse } from "@/types/ai-chat"
import ChatMessage from "./ChatMessage"

interface ChatDrawerProps {
  tripId: string
  isOpen: boolean
  onClose: () => void
  onScheduleUpdate: () => void
}

const QUICK_PROMPTS = [
  "תכנן לי את כל הטיול",
  "מה מתאים לאחר הצהריים?",
  "הוסף אטרקציה לילדים למחר",
  "מה לעשות ביום גשום?",
]

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function ChatDrawer({
  tripId,
  isOpen,
  onClose,
  onScheduleUpdate,
}: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(
    null
  )

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMessage: ChatMessageType = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setIsLoading(true)

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId,
            messages: [...messages, userMessage],
          }),
        })

        if (!res.ok) throw new Error("Failed to get AI response")

        const data: ChatResponse = await res.json()
        setMessages((prev) => [...prev, data.message])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: "מצטער, אירעה שגיאה. אפשר לנסות שוב?",
            timestamp: Date.now(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, messages, tripId]
  )

  const handleApprove = useCallback(
    async (proposalId: string) => {
      const msg = messages.find((m) => m.actionProposal?.id === proposalId)
      if (!msg?.actionProposal) return

      setExecutingProposalId(proposalId)

      try {
        const res = await fetch("/api/ai/chat/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId,
            proposal: msg.actionProposal,
          }),
        })

        if (!res.ok) {
          const data: ExecuteActionResponse = await res.json()
          throw new Error(data.error || "Execution failed")
        }

        // Update proposal status to approved
        setMessages((prev) =>
          prev.map((m) =>
            m.actionProposal?.id === proposalId
              ? {
                  ...m,
                  actionProposal: { ...m.actionProposal!, status: "approved" },
                }
              : m
          )
        )

        // Add confirmation message
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: '✅ השינוי בוצע בהצלחה! הלו"ז עודכן.',
            timestamp: Date.now(),
          },
        ])

        onScheduleUpdate()
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: "שגיאה בביצוע השינוי. אפשר לנסות שוב?",
            timestamp: Date.now(),
          },
        ])
      } finally {
        setExecutingProposalId(null)
      }
    },
    [messages, tripId, onScheduleUpdate]
  )

  const handleReject = useCallback((proposalId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.actionProposal?.id === proposalId
          ? {
              ...m,
              actionProposal: { ...m.actionProposal!, status: "rejected" },
            }
          : m
      )
    )

    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: "assistant",
        content: "בסדר, ביטלתי את השינוי. אפשר לנסות משהו אחר?",
        timestamp: Date.now(),
      },
    ])
  }, [])

  const handleClearChat = useCallback(() => {
    setMessages([])
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      {/* Backdrop — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed left-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 dark:border-zinc-700 dark:bg-zinc-900 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <span className="text-lg">💡</span>
          <h2 className="flex-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            עוזר AI לתכנון הטיול
          </h2>

          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title="נקה שיחה"
            >
              🗑️
            </button>
          )}

          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="סגור"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
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

        {/* Messages area */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <span className="text-5xl">🤖</span>
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  אני העוזר שלך לתכנון הטיול
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  אפשר לבקש ממני לתכנן ימים, להוסיף אטרקציות, או לשנות את
                  הלו&quot;ז
                </p>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  isExecuting={executingProposalId === msg.actionProposal?.id}
                />
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-end">
                  <div className="flex gap-1.5 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="מה תרצה לתכנן?"
              disabled={isLoading}
              className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              title="שלח"
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
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
