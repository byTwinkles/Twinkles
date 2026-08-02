# Romere's Room — Project Structure & Implementation Plan

Scaffold for the "Romere's Room" tracking app described in the functional spec, built as a
installable PWA to match this repo's existing static-site delivery model (no build step,
no backend required to run).

## Project structure

```
public/romere/
├── index.html        # App shell: summary bar, 4 views (Home/Calendar/Gallery/Medical), bottom nav, FAB, modal
├── manifest.json      # PWA manifest (installable, standalone display)
├── sw.js               # Service worker: cache-first shell, network-first updates
├── css/app.css        # Design system tokens (palette, radii, type) + component styles
├── js/app.js          # App state, rendering, and logging logic (see below)
└── icons/icon.svg     # App icon
```

## Data model (local-first)

Entries are stored as a single JSON array in `localStorage["romere:entries"]`, newest first:

```js
{
  id: "e_...",            // stable id
  type: "diaper" | "feeding" | "medication" | "note" | "vitals" | "surgery"
      | "foodDiary" | "photo",
  timestamp: "ISO 8601",
  status: "normal" | ...,  // per-type status vocabulary
  note: "string",
  // type-specific fields:
  meal: "Breakfast" | ...,           // foodDiary
  tag: "Romere" | "Appointment/Milestone", title, photoDataUrl  // photo
}
```

This mirrors the shape a SQLite/WatermelonDB table would take in a production React
Native build — swapping the `loadEntries/addEntry/updateEntry` functions in `app.js` for
DB-backed calls is the only change needed to graduate off `localStorage`.

## Dashboard implementation (spec §3)

- **Summary bar** (`renderSummary`): derives "Last feeding" / "Last diaper" from the most
  recent matching entry; appointment chip is a placeholder until Calendar ships.
- **Tile grid** (`renderTiles`): 8 tiles per spec (Diaper, Feeding, Food Diary, Medication,
  Note, Photo, Vitals, Surgery/Recovery), each showing a relative-time subtitle from its
  last entry.
- **Floating "+" button**: opens a sheet for the less-frequent actions (Add Contact,
  Upload Document) — stubbed pending the Medical document vault.

## Logging implementation (spec §4A)

- **Single tap** (`handleTap`): creates `{ type, timestamp: now, status: "normal" }`,
  flashes the tile blush-pink (`.tile.flash` keyframe), and shows a "Saved!" toast.
- **Re-tap within 60s** (`EDIT_WINDOW_MS`): instead of logging a duplicate, opens the edit
  modal pre-filled with the just-created entry (time, status pills, note).
- **Long press** (500ms via `pointerdown`/`pointerup` timing): opens the same edit modal
  as a fresh draft, letting the user set details before the first save.
- **Food Diary** and **Photo** tiles bypass the generic one-tap flow and open their own
  flows per spec §4B (meal list + add form; file picker → tag → title → save to album).

## Not yet built (next steps)

1. **Calendar** — appointment CRUD, local notification scheduling for meds/appointments.
2. **Gallery** — full album grid reading `type: "photo"` entries, milestone grouping.
3. **Medical/PDX Tracker** — pre-op/surgery/recovery timeline, daily check-in form, and
   "Share Report" PDF export (client-side via `window.print()` with a print stylesheet,
   or a PDF library if richer formatting is needed).
4. **Sync** — encrypted cloud backup (Firebase/Supabase) behind the same storage
   interface used by `app.js`.
5. **Biometric lock** — Face ID gate on launch (native shell) or WebAuthn prompt (PWA).
