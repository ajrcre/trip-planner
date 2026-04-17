"use client"

import React, { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const markdownComponents = {
  a: ({ href, children }: React.ComponentProps<"a">) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline dark:text-blue-400"
    >
      {children}
    </a>
  ),
  p: ({ children }: React.ComponentProps<"p">) => <p className="whitespace-pre-wrap break-words">{children}</p>,
  ul: ({ children }: React.ComponentProps<"ul">) => <ul className="list-inside list-disc">{children}</ul>,
  ol: ({ children }: React.ComponentProps<"ol">) => <ol className="list-inside list-decimal">{children}</ol>,
  code: ({ children }: React.ComponentProps<"code">) => (
    <code className="rounded bg-zinc-100 px-1 font-mono text-[0.9em] dark:bg-zinc-700">{children}</code>
  ),
  h1: ({ children }: React.ComponentProps<"h1">) => <span className="font-semibold">{children}</span>,
  h2: ({ children }: React.ComponentProps<"h2">) => <span className="font-semibold">{children}</span>,
  h3: ({ children }: React.ComponentProps<"h3">) => <span className="font-semibold">{children}</span>,
}

export function TextWithLinks({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || expanded) return
    setCanExpand(el.scrollHeight > el.clientHeight + 1)
  }, [text, expanded])

  return (
    <div className={className}>
      <div
        ref={ref}
        className={`markdown-content ${expanded ? "" : "line-clamp-3"}`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {text}
        </ReactMarkdown>
      </div>
      {canExpand && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          className="mt-0.5 text-blue-600 hover:underline dark:text-blue-400"
        >
          {expanded ? "הצג פחות" : "הצג עוד"}
        </button>
      )}
    </div>
  )
}
