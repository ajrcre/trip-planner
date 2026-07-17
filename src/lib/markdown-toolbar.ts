export interface EditResult {
  text: string
  selectionStart: number
  selectionEnd: number
}

/** Wraps the selected substring of `value` with `prefix`/`suffix`, preserving the selection inside the new markers. */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string
): EditResult {
  const selected = value.slice(start, end)
  const text = value.slice(0, start) + prefix + selected + suffix + value.slice(end)
  const selectionStart = start + prefix.length
  const selectionEnd = selectionStart + selected.length
  return { text, selectionStart, selectionEnd }
}

/**
 * Turns the selection into a markdown link.
 * - Selection is a URL: wraps it as `[קישור](url)` and selects the placeholder label for renaming.
 * - Selection is plain text (or empty): wraps it as `[text]()` and places the cursor inside the parens for the URL.
 */
export function insertLink(value: string, start: number, end: number): EditResult {
  const selected = value.slice(start, end)
  const isUrl = /^https?:\/\//i.test(selected.trim())

  if (isUrl) {
    const label = "קישור"
    const markdown = `[${label}](${selected.trim()})`
    const text = value.slice(0, start) + markdown + value.slice(end)
    const selectionStart = start + 1
    const selectionEnd = selectionStart + label.length
    return { text, selectionStart, selectionEnd }
  }

  const markdown = `[${selected}]()`
  const text = value.slice(0, start) + markdown + value.slice(end)
  const selectionStart = start + selected.length + 3
  return { text, selectionStart, selectionEnd: selectionStart }
}

/** Prefixes every line touched by the selection with a bullet (`- `) or an incrementing number (`1. `, `2. `, ...). */
export function applyListPrefix(
  value: string,
  start: number,
  end: number,
  ordered: boolean
): EditResult {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1
  const nextBreak = value.indexOf("\n", end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak

  const block = value.slice(lineStart, lineEnd)
  const lines = block.split("\n")
  let counter = 1
  const newLines = lines.map((line) => (ordered ? `${counter++}. ${line}` : `- ${line}`))
  const newBlock = newLines.join("\n")

  const text = value.slice(0, lineStart) + newBlock + value.slice(lineEnd)
  const selectionStart = lineStart
  const selectionEnd = lineStart + newBlock.length
  return { text, selectionStart, selectionEnd }
}
