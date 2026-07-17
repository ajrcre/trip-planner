# Notes Improvements — Design

**Date:** 2026-07-17
**Status:** Approved pending user review

## Goal

Four related improvements to notes across the app:

1. Free-text notes on each Overview item (flights, accommodations, car rentals).
2. Bug fix: clearing an activity note in the Schedule doesn't persist.
3. A general per-day note in the Schedule (large textbox).
4. Markdown support with a formatting toolbar in all note fields.

## User decisions

- Editor: lightweight toolbar over a plain `<textarea>` that inserts markdown syntax around the selection (not a WYSIWYG library).
- Overview item notes are edited only through the existing "ערוך פרטים" edit mode (no inline editing on view cards).
- Day note is displayed with an emphasized yellow background (`bg-warning`-style tint) at the top of each day, above the activities.

## 1. Shared markdown editor — `MarkdownTextarea`

New component `src/components/shared/MarkdownTextarea.tsx`:

- Controlled component: `{ value, onChange, rows?, placeholder?, className? }` — a drop-in replacement for the plain `<textarea>` used for notes today.
- Toolbar buttons (RTL order): Bold, Italic, Underline, Strikethrough | Link | Numbered list, Bullet list.
- Each button wraps/prefixes the current selection with markdown syntax and restores focus + selection:
  - Bold `**text**`, Italic `*text*`, Strikethrough `~~text~~` (GFM).
  - Underline: markdown has no underline — use literal `<u>text</u>` tags in the stored text.
  - Link: wraps selection as `[text](url)`; if the selection is a URL, uses it as the href.
  - Lists: prefix each selected line with `1. ` / `- `.
- No live preview pane; rendering happens after save via the existing `TextWithLinks`.

### Rendering `<u>` safely

`TextWithLinks` (react-markdown + remarkGfm) currently escapes raw HTML, so `<u>` would show literally. Add `rehype-raw` + `rehype-sanitize` with a schema restricted to the default sanitize schema plus `u` — all other raw HTML stays stripped. `TextWithLinks` remains the single rendering path for all notes.

New dependencies: `rehype-raw`, `rehype-sanitize`.

### Adoption

Replace the notes `<textarea>` with `MarkdownTextarea` in:

- `ActivityCard` (edit activity notes)
- `DayTimeline` (add-activity dialog notes + alternative notes rows)
- Overview edit forms (new notes fields, see §2)
- Day note editor (see §4)

## 2. Overview item notes

Flights, accommodations, and car rentals live in JSON columns on `Trip` — add an optional `notes` string to each item object. No DB migration.

- Types: add `notes?: string | null` to `FlightLeg`, `CarRental` (`src/lib/normalizers.ts`) and `Accommodation` (`src/lib/accommodations.ts`).
- Edit forms: add a `notes` field (with `MarkdownTextarea`) to `FlightsList`, `AccommodationsList`, `CarRentalsList` form data + `makeEmpty*` helpers, and include it in `OverviewTab.handleStartEdit`/`handleSaveEdit` mapping. An item with only a note counts as non-empty in the save filters.
- Display: in `OverviewTab` view mode, render the note at the bottom of each item block — a note icon + `TextWithLinks`, separated by a top border (per mockup). Hidden when empty.
- Gemini extraction/merge flows are untouched; unknown `notes` keys simply pass through the JSON.

## 3. Bug fix — clearing an activity note

Root cause (two layers):

- `ActivityCard.handleSave` sends `notes: editNotes || undefined` — an emptied note becomes `undefined` (src/components/schedule/ActivityCard.tsx:248,264,271).
- `DayTimeline.handleEditActivity` merges with `notes: updates.notes ?? a.notes` (src/components/schedule/DayTimeline.tsx:400) — `undefined` falls back to the old note, so it is never cleared.

Fix:

- `ActivityCard`: send `notes: editNotes.trim() ? editNotes : null` in all three branches.
- `DayTimeline`: merge with `notes: updates.notes !== undefined ? updates.notes : a.notes`.

Server already handles `null` correctly (`notes: activity.notes ?? null`).

## 4. Day-level general note

- Schema: add `notes String? @db.Text` to `DayPlan` + Prisma migration.
- API: new `PATCH` handler on `/api/trips/[tripId]/schedule/[dayId]` accepting `{ notes: string | null }`, guarded by `requireTripAccess` + viewer check like the other handlers. Keeps day-note saves independent of the heavy activities `PUT` (which deletes/recreates activities).
- Existing `GET /schedule` responses include the new column automatically (Prisma model field).
- UI (in `DayTimeline`, top of the day above activities):
  - With a note: yellow tinted box (amber background in light/dark variants), note icon, markdown-rendered content via `TextWithLinks`, and an edit (pencil) button.
  - Without a note: a subtle "+ הוסף הערה ליום" button.
  - Editing: the box switches to a `MarkdownTextarea` (large, ~4 rows) with save/cancel buttons; saving an empty text stores `null` and returns to the "add" state.
- `DayPlanData` interface and `ScheduleView` plumbing gain the `notes` field.

## Testing

- Unit test for the `MarkdownTextarea` selection-wrapping helpers (pure functions, extracted for testability).
- Manual verification in the browser preview: create/edit/clear notes in all four surfaces, verify markdown rendering (bold, underline, links, lists), verify clearing an activity note persists after refresh.

## Out of scope

- Notes on the Dates card in Overview (it has no per-item structure).
- WYSIWYG editing, tables/images in markdown, note history.
