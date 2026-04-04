# Shopping List Translation Feature

## Problem

When shopping in a foreign country, users need to communicate item names to local store employees. The shopping list is in Hebrew, which is useless in most destinations. Users need translations in the local language, with pronunciation guides and audio playback.

## Solution

Add local-language translations to every shopping list item, powered by Gemini AI. Translations are persisted in the database so they're available offline (the page was loaded before entering the store).

## Data Model

Add three nullable columns to `ShoppingItem`:

```prisma
model ShoppingItem {
  // ... existing fields ...
  localName       String?
  transliteration String?
  localLanguage   String?   // ISO country code — tracks which language the translation is for
}
```

`localLanguage` stores the country code at translation time so we can detect stale translations when the destination changes.

## Translation Engine

New function in `src/lib/gemini-extraction.ts`:

```ts
translateShoppingItems(
  items: Array<{ id: string; item: string }>,
  countryCode: string
): Promise<Array<{ id: string; localName: string; transliteration: string }>>
```

- Single Gemini call for the entire batch
- Prompt asks for item-level JSON: local language name + Hebrew-letter transliteration
- Country code determines the target language

## Translation Triggers

### 1. On item add (`POST /api/trips/[tripId]/shopping`)

After creating the item, if the trip has `destinationInfo.countryCode`, translate the single new item via Gemini and save the result. Return the item with translation fields populated.

### 2. Manual re-translate (`POST /api/trips/[tripId]/shopping/translate`)

New endpoint. Reads all shopping items + trip's `destinationInfo.countryCode`. Translates items that are either:
- Missing translation (`localName IS NULL`)
- Stale (`localLanguage` differs from current country code)

Updates DB rows in a single `$transaction` and returns the full updated item list.

### 3. On destination info generation (`POST /api/trips/[tripId]/destination`)

After saving destination info, if shopping items exist with missing or stale translations, trigger batch translation automatically.

## UI Changes

### Shared `SpeakButton` component

Extract `SpeakButton` and `langMap` from `DestinationOverview.tsx` into `src/components/shared/SpeakButton.tsx`. Both the destination dictionary and shopping list reuse it.

### `ChecklistManager` updates

Add optional `translation` prop:

```ts
interface TranslationConfig {
  speechLang: string           // BCP-47 lang code for speech synthesis
  onTranslate: () => void      // re-translate callback
  translating: boolean         // show loading state during translation
}
```

Only passed by `ShoppingList`, not by `PackingList`.

When translation data exists on items:
- Below each Hebrew item name, show `localName` in the local script (slightly smaller, muted color) + `transliteration` in parentheses
- A `SpeakButton` appears at the end of the row for items with `localName`
- During translation, a small spinner replaces the speak button

### `ShoppingList` wrapper changes

`ShoppingList` currently only passes `tripId` and a static config. It needs to:
1. Fetch the trip's `destinationInfo` to get `countryCode`
2. Derive `speechLang` from the country code via `langMap`
3. Provide a `handleTranslate` callback that calls `POST /api/trips/[tripId]/shopping/translate`
4. Show a "תרגם לשפה המקומית" button at the top when a destination exists

### `ChecklistItem` type update

Extend the local `ChecklistItem` interface in `ChecklistManager`:

```ts
interface ChecklistItem {
  // ... existing fields ...
  localName?: string | null
  transliteration?: string | null
  localLanguage?: string | null
}
```

## Item display layout (per row)

```
[X] [delete]  חלב                           🔊
              Latte (לאטֶּה)
```

- First line: checkbox + Hebrew name (existing)
- Second line: `localName` + `(transliteration)` in smaller text
- Speak button aligned to the right of the row

## Out of Scope

- Packing list translation (not useful — packing happens at home)
- Offline service worker / PWA caching (browser cache + pre-loaded page suffices)
- User-editable translations
- Language picker (always uses trip destination)
- Template translation (templates are Hebrew; translations happen per-item after creation)
