"use client"

import type { ChatMessage as ChatMessageType } from "@/types/ai-chat"
import ActionProposalCard from "./ActionProposalCard"

interface ChatMessageProps {
  message: ChatMessageType
  onApprove?: (proposalId: string) => void
  onReject?: (proposalId: string) => void
  isExecuting?: boolean
}

export default function ChatMessage({
  message,
  onApprove,
  onReject,
  isExecuting = false,
}: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <div
      dir="rtl"
      className={`flex ${isUser ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-blue-600 text-white"
            : "border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>

        {message.actionProposal && (
          <div className="mt-3">
            <ActionProposalCard
              proposal={message.actionProposal}
              onApprove={() => onApprove?.(message.actionProposal!.id)}
              onReject={() => onReject?.(message.actionProposal!.id)}
              isExecuting={isExecuting}
            />
          </div>
        )}
      </div>
    </div>
  )
}
