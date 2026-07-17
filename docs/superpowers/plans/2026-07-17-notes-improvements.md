# Notes Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free-text notes to Overview items and a day-level note in the Schedule, fix the bug where clearing an activity note doesn't persist, and give every note field markdown formatting via a shared toolbar textarea.

**Architecture:** One new pure-function module (`markdown-toolbar.ts`) backs one new shared component (`MarkdownTextarea`), which replaces every plain `<textarea>` currently used for notes. Overview item notes ride on the existing JSON columns (no migration); the day note needs one new `DayPlan.notes` column, a `PATCH` endpoint, and UI in `DayTimeline`. `TextWithLinks` gains sanitized raw-HTML support so `<u>` (underline) renders.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Prisma 7 + PostgreSQL, react-markdown + remark-gfm (existing), rehype-raw + rehype-sanitize (new), Jest + ts-jest.

## Global Constraints

- Follow the approved design spec at `docs/superpowers/specs/2026-07-17-notes-improvements-design.md`.
- Hebrew-first UI, RTL layout — all new labels/placeholders in Hebrew, matching existing strings' tone.
- Tests only for pure `.ts` logic (`src/lib/__tests__/*.test.ts` — Jest `testMatch` does not pick up `.tsx`). Component/UI behavior is verified manually via the browser preview in the final task, including a mobile viewport pass.
- No new UI icon library — use existing patterns already in the codebase (plain glyphs / inline SVG / emoji, matching `ActivityCard.tsx`'s existing icon usage).
- `.env` has been copied into this worktree from the main repo so `npm run dev` and Prisma commands work locally.

---

### Task 1: Markdown toolbar pure functions

**Files:**
- Create: `src/lib/markdown-toolbar.ts`
- Test: `src/lib/__tests__/markdown-toolbar.test.ts`

**Interfaces:**
- Produces: `EditResult { text: string; selectionStart: number; selectionEnd: number }`, `wrapSelection(value: string, start: number, end: number, prefix: string, suffix: string): EditResult`, `insertLink(value: string, start: number, end: number): EditResult`, `applyListPrefix(value: string, start: number, end: number, ordered: boolean): EditResult`. Task 2 (`MarkdownTextarea`) consumes all four.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/markdown-toolbar.test.ts
import { wrapSelection, insertLink, applyListPrefix } from "../markdown-toolbar"

describe("wrapSelection", () => {
  it("wraps a selected substring with prefix and suffix", () => {
    const result = wrapSelection("hello world", 6, 11, "**", "**")
    expect(result.text).toBe("hello **world**")
    expect(result.selectionStart).toBe(8)
    expect(result.selectionEnd).toBe(13)
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe("world")
  })

  it("inserts empty markers at the cursor when nothing is selected", () => {
    const result = wrapSelection("hello ", 6, 6, "*", "*")
    expect(result.text).toBe("hello **")
    expect(result.selectionStart).toBe(7)
    expect(result.selectionEnd).toBe(7)
  })

  it("supports different prefix and suffix (underline tags)", () => {
    const result = wrapSelection("hello world", 6, 11, "<u>", "</u>")
    expect(result.text).toBe("hello <u>world</u>")
  })
})

describe("insertLink", () => {
  it("wraps a selected URL as a link and selects the placeholder label", () => {
    const result = insertLink("visit https://example.com now", 6, 25)
    expect(result.text).toBe("visit [קישור](https://example.com) now")
    expect(result.text.slice(result.selectionStart, result.selectionEnd)).toBe("קישור")
  })

  it("wraps selected text as a link label with an empty URL, cursor inside the parens", () => {
    const result = insertLink("check this out", 6, 10)
    expect(result.text).toBe("check [this]() out")
    expect(result.selectionStart).toBe(result.selectionEnd)
    expect(result.text.slice(0, result.selectionStart).endsWith("(")).toBe(true)
  })

  it("inserts empty brackets when nothing is selected", () => {
    const result = insertLink("hello ", 6, 6)
    expect(result.text).toBe("hello []()")
  })
})

describe("applyListPrefix", () => {
  it("adds bullet prefixes to every line touched by the selection", () => {
    const value = "one\ntwo\nthree"
    const result = applyListPrefix(value, 0, value.length, false)
    expect(result.text).toBe("- one\n- two\n- three")
  })

  it("adds incrementing numbers for an ordered list", () => {
    const value = "one\ntwo\nthree"
    const result = applyListPrefix(value, 0, value.length, true)
    expect(result.text).toBe("1. one\n2. two\n3. three")
  })

  it("only affects lines touched by a partial selection", () => {
    const value = "one\ntwo\nthree"
    const result = applyListPrefix(value, 4, 7, false)
    expect(result.text).toBe("one\n- two\nthree")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --testPathPattern=markdown-toolbar`
Expected: FAIL with "Cannot find module '../markdown-toolbar'"

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/markdown-toolbar.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --testPathPattern=markdown-toolbar`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/markdown-toolbar.ts src/lib/__tests__/markdown-toolbar.test.ts
git commit -m "feat: add pure markdown toolbar editing functions"
```

---

### Task 2: `MarkdownTextarea` shared component

**Files:**
- Create: `src/components/shared/MarkdownTextarea.tsx`

**Interfaces:**
- Consumes: `wrapSelection`, `insertLink`, `applyListPrefix`, `EditResult` from `@/lib/markdown-toolbar` (Task 1).
- Produces: `MarkdownTextarea({ value, onChange, rows, placeholder, className }: { value: string; onChange: (value: string) => void; rows?: number; placeholder?: string; className?: string })` — default export style is named export `MarkdownTextarea`, a drop-in replacement for a plain `<textarea>`. Tasks 4–8 import and use this component directly.

- [ ] **Step 1: Write the component**

```tsx
// src/components/shared/MarkdownTextarea.tsx
"use client"

import { useRef } from "react"
import { wrapSelection, insertLink, applyListPrefix, type EditResult } from "@/lib/markdown-toolbar"

interface MarkdownTextareaProps {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  className?: string
}

const buttonClass =
  "rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-zinc-100"

export function MarkdownTextarea({ value, onChange, rows = 3, placeholder, className = "" }: MarkdownTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function applyEdit(fn: (v: string, s: number, e: number) => EditResult) {
    const el = ref.current
    if (!el) return
    const result = fn(value, el.selectionStart, el.selectionEnd)
    onChange(result.text)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  return (
    <div className={`overflow-hidden rounded border border-zinc-300 dark:border-zinc-600 ${className}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900/40">
        <button type="button" title="מודגש" className={`${buttonClass} font-bold`} onClick={() => applyEdit((v, s, e) => wrapSelection(v, s, e, "**", "**"))}>
          B
        </button>
        <button type="button" title="נטוי" className={`${buttonClass} italic`} onClick={() => applyEdit((v, s, e) => wrapSelection(v, s, e, "*", "*"))}>
          I
        </button>
        <button type="button" title="קו תחתון" className={`${buttonClass} underline`} onClick={() => applyEdit((v, s, e) => wrapSelection(v, s, e, "<u>", "</u>"))}>
          U
        </button>
        <button type="button" title="קו חוצה" className={`${buttonClass} line-through`} onClick={() => applyEdit((v, s, e) => wrapSelection(v, s, e, "~~", "~~"))}>
          S
        </button>
        <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
        <button type="button" title="קישור" className={buttonClass} onClick={() => applyEdit((v, s, e) => insertLink(v, s, e))}>
          🔗
        </button>
        <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-600" />
        <button type="button" title="רשימה ממוספרת" className={buttonClass} onClick={() => applyEdit((v, s, e) => applyListPrefix(v, s, e, true))}>
          1.
        </button>
        <button type="button" title="רשימת תבליטים" className={buttonClass} onClick={() => applyEdit((v, s, e) => applyListPrefix(v, s, e, false))}>
          •
        </button>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm focus:outline-none dark:bg-zinc-700"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors from `MarkdownTextarea.tsx` (it is not imported anywhere yet, so this only confirms the file itself is well-typed)

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/MarkdownTextarea.tsx
git commit -m "feat: add MarkdownTextarea toolbar component"
```

---

### Task 3: Underline support in `TextWithLinks`

**Files:**
- Modify: `src/components/shared/TextWithLinks.tsx`
- Modify: `package.json`, `package-lock.json` (new dependencies)

**Interfaces:**
- No exported interface changes — `TextWithLinks({ text, className }: { text: string; className?: string })` keeps its existing signature. This task only changes what markdown syntax it renders.

- [ ] **Step 1: Install the new dependencies**

Run: `npm install rehype-raw rehype-sanitize`
Expected: `package.json` gains `rehype-raw` and `rehype-sanitize` under `dependencies`

- [ ] **Step 2: Add sanitized raw-HTML rendering for `<u>`**

In `src/components/shared/TextWithLinks.tsx`, add the imports after the existing ones:

```tsx
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
```

Add this constant after `markdownComponents` (before `export function TextWithLinks`):

```tsx
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u"],
}
```

Change the `<ReactMarkdown>` call (currently `<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>`) to:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
  components={markdownComponents}
>
```

- [ ] **Step 3: Verify type-checking passes**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Manual smoke check**

Run: `npx jest` (full suite, confirms nothing else broke)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/shared/TextWithLinks.tsx
git commit -m "feat: render sanitized <u> tags in markdown notes"
```

---

### Task 4: Fix the activity-note clearing bug and adopt `MarkdownTextarea`

**Files:**
- Modify: `src/components/schedule/ActivityCard.tsx`
- Modify: `src/components/schedule/DayTimeline.tsx`

**Interfaces:**
- Consumes: `MarkdownTextarea` (Task 2).
- Produces: `ActivityCard`'s `onEdit` updates type changes from `notes?: string` to `notes?: string | null`; `DayTimeline.handleEditActivity`'s `updates` parameter type changes to match.

**Root cause:** `ActivityCard.handleSave` sends `notes: editNotes || undefined` — an emptied textarea becomes `undefined`. `DayTimeline.handleEditActivity` then merges with `notes: updates.notes ?? a.notes`, so `undefined` falls back to the old value and the note is never cleared.

- [ ] **Step 1: Widen the `onEdit`/`updates` notes type in `ActivityCard.tsx`**

In `src/components/schedule/ActivityCard.tsx`, change the `onEdit` prop type (around line 120-129):

```typescript
  onEdit: (
    activity: ActivityData,
    updates: {
      timeStart?: string
      timeEnd?: string
      notes?: string | null
      travelLeg?: { origin: TravelEndpointRef; destination: TravelEndpointRef } | null
      restAccommodationIndex?: number | null
    }
  ) => void | Promise<void>
```

- [ ] **Step 2: Fix the three `handleSave` call sites in `ActivityCard.tsx`**

Replace all three occurrences of `notes: editNotes || undefined,` (in the `travel`, `rest`, and default branches of `handleSave`, around lines 248, 264, 271) with:

```typescript
        notes: editNotes.trim() ? editNotes : null,
```

- [ ] **Step 3: Replace the notes `<textarea>` with `MarkdownTextarea` in `ActivityCard.tsx`**

Add the import near the top of the file:

```typescript
import { MarkdownTextarea } from "@/components/shared/MarkdownTextarea"
```

Replace the notes block (around lines 456-465):

```tsx
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">{"הערות"}</label>
            <textarea
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder={"הערות..."}
              className="resize-none rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
            />
          </div>
```

with:

```tsx
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">{"הערות"}</label>
            <MarkdownTextarea
              value={editNotes}
              onChange={setEditNotes}
              rows={3}
              placeholder={"הערות..."}
            />
          </div>
```

- [ ] **Step 4: Fix the merge logic and widen the type in `DayTimeline.tsx`**

Change `handleEditActivity`'s parameter type (around lines 382-391):

```typescript
  async function handleEditActivity(
    activity: ActivityData,
    updates: {
      timeStart?: string
      timeEnd?: string
      notes?: string | null
      travelLeg?: { origin: TravelEndpointRef; destination: TravelEndpointRef } | null
      restAccommodationIndex?: number | null
    }
  ) {
```

Change the merge (around line 400) from:

```typescript
            notes: updates.notes ?? a.notes,
```

to:

```typescript
            notes: updates.notes !== undefined ? updates.notes : a.notes,
```

- [ ] **Step 5: Adopt `MarkdownTextarea` for the add-activity notes field and the inline alternative-notes fields in `DayTimeline.tsx`**

Add the import near the top of the file:

```typescript
import { MarkdownTextarea } from "@/components/shared/MarkdownTextarea"
```

Replace the add-activity notes block (around lines 875-884):

```tsx
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">{"הערות"}</label>
              <textarea
                rows={3}
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder={"הערות..."}
                className="resize-none rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
            </div>
```

with:

```tsx
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">{"הערות"}</label>
              <MarkdownTextarea
                value={addNotes}
                onChange={setAddNotes}
                rows={3}
                placeholder={"הערות..."}
              />
            </div>
```

Replace the alternative-row notes textarea (around lines 751-757):

```tsx
                    <textarea
                      rows={3}
                      value={alt.notes}
                      onChange={(e) => updateAltRow(i, "notes", e.target.value)}
                      placeholder="הערות לחלופה (אופציונלי)..."
                      className="resize-none rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-700"
                    />
```

with:

```tsx
                    <MarkdownTextarea
                      value={alt.notes}
                      onChange={(v) => updateAltRow(i, "notes", v)}
                      rows={3}
                      placeholder="הערות לחלופה (אופציונלי)..."
                    />
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/schedule/ActivityCard.tsx src/components/schedule/DayTimeline.tsx
git commit -m "fix: persist cleared activity notes and adopt markdown editor"
```

---

### Task 5: Overview item notes — types and edit forms

**Files:**
- Modify: `src/lib/normalizers.ts`
- Modify: `src/lib/accommodations.ts`
- Modify: `src/components/trips/FlightsList.tsx`
- Modify: `src/components/trips/AccommodationsList.tsx`
- Modify: `src/components/trips/CarRentalsList.tsx`

**Interfaces:**
- Consumes: `MarkdownTextarea` (Task 2).
- Produces: `FlightLeg.notes?: string | null`, `CarRental.notes?: string | null` (type only — `CarRental` continues to use its existing `additionalDetails` field as the actual notes surface, see Step 4), `Accommodation.notes?: string`, `FlightFormData.notes: string`, `AccommodationFormData.notes: string`. Task 6 (`OverviewTab`) consumes all of these.

- [ ] **Step 1: Add `notes` to `FlightLeg` and `CarRental` types**

In `src/lib/normalizers.ts`, add to `FlightLeg` (after `arrivalTime`):

```typescript
  notes?: string | null
```

Add to `CarRental` (after `additionalDetails`) for type parity with the others, even though `additionalDetails` remains the field actually used for free text:

```typescript
  notes?: string | null
```

- [ ] **Step 2: Add `notes` to `Accommodation` type**

In `src/lib/accommodations.ts`, add to the `Accommodation` interface (after `bookingReference`):

```typescript
  notes?: string;
```

- [ ] **Step 3: Add a notes field to `FlightsList`**

In `src/components/trips/FlightsList.tsx`, add the import:

```typescript
import { MarkdownTextarea } from "@/components/shared/MarkdownTextarea"
```

Add `notes: string` to `FlightFormData`:

```typescript
interface FlightFormData {
  _id: number
  flightNumber: string
  departureAirport: string
  departureTime: string
  arrivalAirport: string
  arrivalTime: string
  notes: string
}
```

Update `makeEmptyFlight`:

```typescript
export function makeEmptyFlight(): FlightFormData {
  return { _id: _nextFlightId++, flightNumber: "", departureAirport: "", departureTime: "", arrivalAirport: "", arrivalTime: "", notes: "" }
}
```

Add a notes row inside the `grid gap-4 sm:grid-cols-2` div, right after the arrival-time `InputField`:

```tsx
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">הערות</span>
              <MarkdownTextarea value={flight.notes} onChange={(v) => updateItem(idx, "notes", v)} rows={2} />
            </label>
```

- [ ] **Step 4: Add a notes field to `AccommodationsList`**

In `src/components/trips/AccommodationsList.tsx`, add the import:

```typescript
import { MarkdownTextarea } from "@/components/shared/MarkdownTextarea"
```

Add `notes: string` to `AccommodationFormData`:

```typescript
interface AccommodationFormData {
  _id: number
  name: string
  address: string
  website: string
  checkIn: string
  checkOut: string
  contact: string
  bookingReference: string
  notes: string
}
```

Update `makeEmptyAccommodation`:

```typescript
export function makeEmptyAccommodation(): AccommodationFormData {
  return { _id: _nextId++, name: "", address: "", website: "", checkIn: "", checkOut: "", contact: "", bookingReference: "", notes: "" }
}
```

Add a notes row inside the `grid gap-4 sm:grid-cols-2` div, right after the booking-reference `InputField`:

```tsx
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">הערות</span>
              <MarkdownTextarea value={acc.notes} onChange={(v) => updateItem(idx, "notes", v)} rows={2} />
            </label>
```

- [ ] **Step 5: Upgrade `CarRentalsList`'s existing free-text field to `MarkdownTextarea`**

`CarRentalFormData` already has `additionalDetails: string`, which is the item's free-text notes field — no new field needed here. In `src/components/trips/CarRentalsList.tsx`, add the import:

```typescript
import { MarkdownTextarea } from "@/components/shared/MarkdownTextarea"
```

Replace the `additionalDetails` block:

```tsx
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">פרטים נוספים</span>
              <textarea
                value={rental.additionalDetails}
                onChange={(e) => updateItem(idx, "additionalDetails", e.target.value)}
                rows={2}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
              />
            </label>
```

with:

```tsx
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">פרטים נוספים</span>
              <MarkdownTextarea value={rental.additionalDetails} onChange={(v) => updateItem(idx, "additionalDetails", v)} rows={2} />
            </label>
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `OverviewTab.tsx` (not yet updated — expected, fixed in Task 6)

- [ ] **Step 7: Commit**

```bash
git add src/lib/normalizers.ts src/lib/accommodations.ts src/components/trips/FlightsList.tsx src/components/trips/AccommodationsList.tsx src/components/trips/CarRentalsList.tsx
git commit -m "feat: add notes field to flight/accommodation/car-rental edit forms"
```

---

### Task 6: Overview item notes — wire up `OverviewTab`

**Files:**
- Modify: `src/components/trips/tabs/OverviewTab.tsx`

**Interfaces:**
- Consumes: `TextWithLinks` (existing, now with underline support from Task 3), the widened `FlightFormData`/`AccommodationFormData` (Task 5).

- [ ] **Step 1: Import `TextWithLinks` and add a local `NoteBlock` helper**

Add the import near the top:

```typescript
import { TextWithLinks } from "@/components/shared/TextWithLinks"
```

Add this component after `LocationLinks` (before `export function OverviewTab`):

```tsx
function NoteBlock({ text }: { text?: string | null }) {
  if (!text) return null
  return (
    <div className="mt-2 flex items-start gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-700">
      <span className="text-sm text-zinc-400">📝</span>
      <TextWithLinks text={text} className="flex-1 text-sm text-zinc-600 dark:text-zinc-300" />
    </div>
  )
}
```

- [ ] **Step 2: Include `notes` when entering edit mode**

In `handleStartEdit`, update the three `setEdit*` calls:

```typescript
    setEditFlights(
      flightsData.length > 0
        ? flightsData.map(f => ({ _id: id++, flightNumber: f.flightNumber || "", departureAirport: f.departureAirport || "", departureTime: f.departureTime || "", arrivalAirport: f.arrivalAirport || "", arrivalTime: f.arrivalTime || "", notes: f.notes || "" }))
        : [makeEmptyFlight()]
    )
    setEditAccommodations(
      accommodations.length > 0
        ? accommodations.map(a => ({ _id: id++, name: a.name || "", address: a.address || "", website: a.website || "", checkIn: a.checkIn || "", checkOut: a.checkOut || "", contact: a.contact || "", bookingReference: a.bookingReference || "", notes: a.notes || "" }))
        : [makeEmptyAccommodation()]
    )
    setEditCarRentals(
      carRentalsData.length > 0
        ? carRentalsData.map(r => ({ _id: id++, company: r.company || "", pickupLocation: r.pickupLocation || "", pickupTime: r.pickupTime || "", returnLocation: r.returnLocation || "", returnTime: r.returnTime || "", additionalDetails: r.additionalDetails || "" }))
        : [makeEmptyCarRental()]
    )
```

(Only the flights and accommodations lines change — car rentals already carries `additionalDetails` through unchanged.)

- [ ] **Step 3: Include `notes` in the non-empty filter and save payload**

In `handleSaveEdit`, update the three filters:

```typescript
      const validFlights = editFlights
        .filter(f => f.flightNumber || f.departureAirport || f.arrivalAirport || f.notes)
        .map(({ _id, ...rest }) => rest)
      const validAccommodations = editAccommodations
        .filter(a => a.name || a.address || a.website || a.checkIn || a.checkOut || a.contact || a.bookingReference || a.notes)
        .map(({ _id, ...rest }) => rest)
      const validCarRentals = editCarRentals
        .filter(r => r.company || r.pickupLocation || r.returnLocation || r.additionalDetails)
        .map(({ _id, ...rest }) => rest)
```

- [ ] **Step 4: Display notes on the Accommodation, Flights, and Car Rental view cards**

In the Accommodation `.map` block, add `<NoteBlock text={acc.notes} />` right after the existing `<div className="flex flex-col gap-2">...</div>` closes (still inside the outer per-item `<div>`):

```tsx
                <div className="flex flex-col gap-2">
                  {accommodations.length === 1 && <InfoRow label="שם" value={acc.name} />}
                  <InfoRow label="כתובת" value={acc.address} />
                  {(acc.address || acc.name) && <LocationLinks address={acc.address || acc.name || ""} />}
                  <LinkInfoRow label="אתר" value={acc.website ?? undefined} />
                  <InfoRow label="צ'ק-אין" value={acc.checkIn ? formatUiDateTime(acc.checkIn) : undefined} />
                  <InfoRow label="צ'ק-אאוט" value={acc.checkOut ? formatUiDateTime(acc.checkOut) : undefined} />
                  <InfoRow label="פרטי קשר" value={acc.contact} />
                  <InfoRow label="מספר הזמנה" value={acc.bookingReference} />
                </div>
                <NoteBlock text={acc.notes} />
```

In the Flights `.map` block, add `<NoteBlock text={flight.notes} />` right after the existing notes `<div className="flex flex-col gap-1">...</div>` closes:

```tsx
                <div className="flex flex-col gap-1">
                  <InfoRow label="מספר טיסה" value={flight.flightNumber} />
                  <InfoRow
                    label="יציאה"
                    value={flight.departureAirport
                      ? `${flight.departureAirport}${flight.departureTime ? ` - ${formatUiDateTime(flight.departureTime)}` : ""}`
                      : undefined}
                  />
                  <InfoRow
                    label="נחיתה"
                    value={flight.arrivalAirport
                      ? `${flight.arrivalAirport}${flight.arrivalTime ? ` - ${formatUiDateTime(flight.arrivalTime)}` : ""}`
                      : undefined}
                  />
                </div>
                <NoteBlock text={flight.notes} />
```

In the Car Rentals `.map` block, replace `<InfoRow label="פרטים נוספים" value={rental.additionalDetails} />` with `<NoteBlock text={rental.additionalDetails} />`:

```tsx
                <div className="flex flex-col gap-2">
                  <InfoRow label="חברה" value={rental.company} />
                  <InfoRow label="מיקום איסוף" value={rental.pickupLocation} />
                  {rental.pickupLocation && <LocationLinks address={rental.pickupLocation} />}
                  <InfoRow label="מיקום החזרה" value={rental.returnLocation} />
                  {rental.returnLocation && rental.returnLocation !== rental.pickupLocation && (
                    <LocationLinks address={rental.returnLocation} />
                  )}
                  <NoteBlock text={rental.additionalDetails} />
                </div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/trips/tabs/OverviewTab.tsx
git commit -m "feat: display and edit notes on Overview items"
```

---

### Task 7: `DayPlan.notes` schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260717120000_add_dayplan_notes/migration.sql`

**Interfaces:**
- Produces: `DayPlan.notes: string | null` on the Prisma model/client. Task 8 (API) and Task 9 (UI type) consume this.

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, in the `DayPlan` model, add `notes` right after `isLocked`:

```prisma
model DayPlan {
  id     String @id @default(cuid())
  tripId String
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)

  date     DateTime
  dayType  String
  isLocked Boolean  @default(false)
  notes    String?  @db.Text

  activities Activity[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tripId, date])
  @@index([tripId])
}
```

- [ ] **Step 2: Write the migration SQL**

```sql
-- prisma/migrations/20260717120000_add_dayplan_notes/migration.sql
-- AlterTable
ALTER TABLE "DayPlan" ADD COLUMN "notes" TEXT;
```

- [ ] **Step 3: Apply the migration to the local dev database**

Run: `npx prisma migrate dev --name add_dayplan_notes`
Expected: Prisma detects the migration file already matches the pending schema change, applies it, and reports the database is in sync (if it instead tries to create a duplicate migration, confirm the migration folder name/timestamp is later than the last applied one and re-run)

- [ ] **Step 4: Regenerate the Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" with no errors, output to `src/generated/prisma`

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260717120000_add_dayplan_notes
git commit -m "feat: add notes column to DayPlan"
```

---

### Task 8: Day-note `PATCH` endpoint

**Files:**
- Modify: `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts`

**Interfaces:**
- Consumes: `verifyDayPlan`, `requireTripAccess` (existing helpers in the same file).
- Produces: `PATCH /api/trips/[tripId]/schedule/[dayId]` accepting `{ notes: string | null }`, returning the updated `DayPlan` as JSON. Task 9 (UI) calls this endpoint.

- [ ] **Step 1: Add the handler**

Add this function at the end of `src/app/api/trips/[tripId]/schedule/[dayId]/route.ts` (after the `DELETE` handler):

```typescript
// PATCH — Update the day-level note
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string; dayId: string }> }
) {
  const { tripId, dayId } = await params

  const result = await requireTripAccess(tripId)
  if (result instanceof NextResponse) return result
  const { role } = result

  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const dayPlan = await verifyDayPlan(dayId, tripId)
  if (!dayPlan) {
    return NextResponse.json({ error: "Day plan not found" }, { status: 404 })
  }

  const body = await request.json()
  const { notes } = body

  if (notes !== null && typeof notes !== "string") {
    return NextResponse.json(
      { error: "notes must be a string or null" },
      { status: 400 }
    )
  }

  const updated = await prisma.dayPlan.update({
    where: { id: dayId },
    data: { notes: notes === "" ? null : notes },
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trips/[tripId]/schedule/[dayId]/route.ts
git commit -m "feat: add PATCH endpoint for day-level notes"
```

---

### Task 9: Day-note UI in `DayTimeline`

**Files:**
- Modify: `src/components/schedule/DayTimeline.tsx`

**Interfaces:**
- Consumes: `MarkdownTextarea` (Task 2), `TextWithLinks` (Task 3), `PATCH /api/trips/[tripId]/schedule/[dayId]` (Task 8).
- Produces: `DayPlanData.notes: string | null` — `ScheduleView.tsx` already passes the full `DayPlanData` object through from the `GET /schedule` response (which now includes `notes` automatically via Prisma's `include`), so no other file needs to change.

- [ ] **Step 1: Add `notes` to `DayPlanData` and import dependencies**

In `src/components/schedule/DayTimeline.tsx`, update the interface:

```typescript
export interface DayPlanData {
  id: string
  date: string
  dayType: string
  notes: string | null
  activities: ActivityData[]
}
```

Add imports near the top:

```typescript
import { MarkdownTextarea } from "@/components/shared/MarkdownTextarea"
import { TextWithLinks } from "@/components/shared/TextWithLinks"
```

- [ ] **Step 2: Add day-note state and a save handler**

Inside `DayTimeline`, after the existing `useState` declarations (after `deletingId`), add:

```typescript
  const [isEditingDayNote, setIsEditingDayNote] = useState(false)
  const [dayNoteDraft, setDayNoteDraft] = useState(dayPlan.notes ?? "")
  const [isSavingDayNote, setIsSavingDayNote] = useState(false)
```

After `handleDeleteActivity`, add:

```typescript
  async function handleSaveDayNote() {
    setIsSavingDayNote(true)
    try {
      const res = await fetch(`/api/trips/${tripId}/schedule/${dayPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: dayNoteDraft.trim() ? dayNoteDraft : null }),
      })
      if (res.ok) {
        setIsEditingDayNote(false)
        await onUpdate()
      }
    } catch (error) {
      console.error("Failed to save day note:", error)
    } finally {
      setIsSavingDayNote(false)
    }
  }

  function beginEditingDayNote() {
    setDayNoteDraft(dayPlan.notes ?? "")
    setIsEditingDayNote(true)
  }

  function cancelEditingDayNote() {
    setDayNoteDraft(dayPlan.notes ?? "")
    setIsEditingDayNote(false)
  }
```

- [ ] **Step 3: Render the day-note block above the activities list**

In the JSX returned by `DayTimeline`, replace the opening of the root `<div>`:

```tsx
  return (
    <div className="flex flex-col gap-3">
```

with:

```tsx
  return (
    <div className="flex flex-col gap-3">
      {isEditingDayNote ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
          <MarkdownTextarea value={dayNoteDraft} onChange={setDayNoteDraft} rows={4} placeholder="הערה כללית ליום..." />
          <div className="flex gap-2">
            <button
              onClick={handleSaveDayNote}
              disabled={isSavingDayNote}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSavingDayNote ? "שומר..." : "שמור"}
            </button>
            <button
              onClick={cancelEditingDayNote}
              disabled={isSavingDayNote}
              className="rounded border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-700"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : dayPlan.notes ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
          <span className="text-sm text-amber-600 dark:text-amber-400">📌</span>
          <TextWithLinks text={dayPlan.notes} className="flex-1 text-sm text-amber-800 dark:text-amber-300" />
          <button
            onClick={beginEditingDayNote}
            className="shrink-0 rounded p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            title="עריכה"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={beginEditingDayNote}
          className="self-start text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          + הוסף הערה ליום
        </button>
      )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/schedule/DayTimeline.tsx
git commit -m "feat: add day-level note editor to the schedule timeline"
```

---

### Task 10: Full verification pass (desktop + mobile)

**Files:** none (verification only)

**Interfaces:** none — this task exercises the running app through the browser preview tools.

- [ ] **Step 1: Run the full automated test suite**

Run: `npx jest`
Expected: all tests PASS, including the new `markdown-toolbar.test.ts`

- [ ] **Step 2: Run the linter and full type-check**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Start the dev server and open a trip in the browser (desktop viewport)**

Use the preview tools: start `npm run dev` (add a `dev` configuration to `.claude/launch.json` if one doesn't already exist, pointing at `npm run dev` on port 3000), navigate to a trip's Overview tab.

- [ ] **Step 4: Verify Overview item notes**

Click "ערוך פרטים", type a note containing bold text, a link, and a bullet list into an accommodation's notes field using the toolbar buttons, save, and confirm the note renders with correct markdown formatting (bold, clickable link, bullet) on the view card.

- [ ] **Step 5: Verify the activity-note clearing bug is fixed**

Go to the Schedule tab, open an activity that has an existing note, clear the textarea completely, save, and confirm (via a page refresh or re-fetch) that the note is actually gone and does not reappear.

- [ ] **Step 6: Verify the day-level note**

On a schedule day with no note, click "+ הוסף הערה ליום", type a multi-line note with markdown formatting, save, and confirm it renders in the amber box above the activities. Edit it again and clear it; confirm it reverts to the "+ הוסף הערה ליום" button.

- [ ] **Step 7: Verify markdown rendering across all four surfaces**

Confirm bold, italic, underline, strikethrough, links, and both list types render correctly in: an Overview item note, an activity note, an alternative note, and the day note.

- [ ] **Step 8: Validate mobile viewport**

Use the resize tool to switch to the mobile preset (375x812) and repeat steps 4-6 (add/edit an Overview item note, clear an activity note, add a day note) — confirm the toolbar buttons remain tappable and readable, and the layout doesn't overflow horizontally.

- [ ] **Step 9: Check for console/network errors**

Use the console and network inspection tools to confirm no errors were logged during the flows above.

- [ ] **Step 10: Final commit (if any fixes were needed during verification)**

If verification steps 4-9 surfaced any issues requiring code changes, fix them, re-verify, and commit:

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```

If no issues were found, this task requires no commit.
