"use client"

import { useState } from "react"

export const COUNTRY_SPEECH_LANG: Record<string, string> = {
  it: "it-IT", fr: "fr-FR", es: "es-ES", de: "de-DE", pt: "pt-PT",
  gr: "el-GR", nl: "nl-NL", tr: "tr-TR", jp: "ja-JP", kr: "ko-KR",
  cn: "zh-CN", th: "th-TH", cz: "cs-CZ", pl: "pl-PL", hr: "hr-HR",
  hu: "hu-HU", ro: "ro-RO", bg: "bg-BG", rs: "sr-RS", se: "sv-SE",
  no: "nb-NO", dk: "da-DK", fi: "fi-FI", ru: "ru-RU", ua: "uk-UA",
  gb: "en-GB", us: "en-US", au: "en-AU", at: "de-AT", ch: "de-CH",
  br: "pt-BR", mx: "es-MX", ar: "es-AR", il: "he-IL", eg: "ar-EG",
  ma: "ar-MA", in: "hi-IN", id: "id-ID", vn: "vi-VN", ph: "tl-PH",
}

export function getSpeechLang(countryCode: string): string {
  return COUNTRY_SPEECH_LANG[countryCode] || countryCode
}

export function SpeakButton({
  text,
  lang,
  size = "md",
}: {
  text: string
  lang: string
  size?: "sm" | "md"
}) {
  const [speaking, setSpeaking] = useState(false)

  const handleSpeak = () => {
    if (speaking) {
      speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.85
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    speechSynthesis.speak(utterance)
  }

  const sizeClasses = size === "sm" ? "h-6 w-6" : "h-7 w-7"
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"

  return (
    <button
      onClick={handleSpeak}
      title="השמע"
      className={`inline-flex ${sizeClasses} items-center justify-center rounded-full transition-colors ${
        speaking
          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
          : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
      }`}
    >
      <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z"
        />
      </svg>
    </button>
  )
}
