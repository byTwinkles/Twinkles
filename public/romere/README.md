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

## Gallery implementation (spec §4B)

- **Album grid** (`renderGallery`): reads `type: "photo"` entries — the same ones created
  by the Dashboard's Photo tile or the in-gallery "+ Add photo" button (both call the
  shared `openPhotoFlow`) — and renders them newest-first as square thumbnails.
- **Filter pills** (All / Romere / Milestones): filter by the entry's `tag` field client-side;
  no separate index needed since the entries array is already small and local.
- **Lightbox** (`openLightbox`): full-size photo, title, tag, timestamp, and a delete action,
  reusing the existing modal component rather than a new overlay.
- Entries saved without a selected file (title-only) still render as a tile with a camera
  icon + title, so the flow never silently drops data.

## Calendar implementation

- **Storage**: appointments live in a separate `localStorage["romere:appointments"]` array
  (distinct from the log `entries`, since they're forward-looking scheduled items rather
  than historical logs): `{ id, title, date, time, notes, reminder }`.
- **Today / Upcoming lists** (`renderCalendar`): split by comparing each appointment's date
  against today's date; both lists sort ascending by date+time.
- **Add/edit/delete** (`openAppointmentForm`): one form handles both create and edit —
  editing is triggered by tapping a row, matching the edit-modal pattern used elsewhere in
  the app.
- **Summary bar**: "Next appointment" now reflects the soonest upcoming appointment
  (`nextAppointment`) instead of a placeholder.
- **Reminders**: best-effort only — `scheduleReminder` uses `Notification` + `setTimeout`
  while the app/tab is open, rescheduling everything on load (`scheduleAllReminders`).
  This has no background delivery when the app is closed; a native shell (React Native
  local notifications, or the Notification Triggers API once broadly supported) is needed
  for real "meds due" alerts that fire without the app open.

## Medical / PDX Tracker implementation (spec §4C)

- **Journey setup** (`localStorage["romere:journey"]`): one-time form asking for the
  surgery date plus how many pre-op days and recovery weeks to show — `{ surgeryDate,
  preOpDays, recoveryWeeks }`. Shown automatically until configured.
- **Timeline** (`renderMedical` + `dayInfo`): a day-by-day scrollable list from
  `surgeryDate - preOpDays` through `surgeryDate + recoveryWeeks*7`, each row labeled
  "Pre-op Day -N" / "Surgery Day" / "Recovery Day N" and color-coded by phase. Today's row
  is outlined and auto-scrolled into view; rows with a saved check-in show a "✓ checked in"
  marker.
- **Daily check-in** (`openCheckinForm`): "How is Romere today?" — vitals, meds taken,
  doctor's advice, mom's notes — stored one-per-day in `localStorage["romere:checkins"]`,
  keyed by date so tapping any timeline day (past or today) opens/edits that day's entry.
- **Share Report** (`generateMedicalReport`): compiles every check-in, oldest first, into a
  hidden `#print-report` element styled by an `@media print` stylesheet that hides the app
  chrome, then calls `window.print()` — the browser's own "Save as PDF" produces the
  doctor-friendly export without a PDF library dependency.

## Document vault implementation

- **Storage**: uploads live in `localStorage["romere:documents"]` as `{ id, title,
  fileName, fileType, timestamp, fileDataUrl }` — same data-URL pattern as the Gallery's
  photo entries, so no new persistence approach was introduced.
- **UI**: a dedicated list at the top of the Medical tab (`renderDocuments`), reachable
  either there or via the FAB's "+ Upload document" shortcut (both open the same
  `openDocumentUploadForm`). Tapping a document opens a detail sheet with an
  Open/Download link and delete action.
- Accepts PDFs and images (`accept=".pdf,image/*"`); the icon shown (📄/🖼️/📎) is derived
  from the file's MIME type.

## App lock implementation (best-effort — spec §5 "Privacy")

- **Storage**: `localStorage["romere:lock"]` holds `{ enabled, pinHash, credentialId }`.
  `pinHash` is a SHA-256 digest of a 4-digit PIN (via `crypto.subtle`); `credentialId` is
  a WebAuthn platform-authenticator credential ID, base64-encoded, if enrollment succeeded.
- **Gate** (`applyLockGate`, called as the very first statement in `app.js`, before any
  other declarations): if lock is enabled, the `.app` root is hidden and `#lock-overlay` is
  shown immediately on script execution — before the dashboard renders — to minimize any
  flash of data.
- **Unlock paths**: "Unlock with Face ID / Touch ID" calls `navigator.credentials.get()`
  against the stored credential; the PIN field is always available as a fallback and is
  the only path guaranteed to work across devices/browsers.
- **Enabling the lock** (`openLockSettings`, reachable via the FAB's "🔒 App lock
  settings"): the PIN is hashed and saved *immediately* so the lock takes effect right
  away; biometric enrollment via `navigator.credentials.create()` is attempted
  afterward as a non-blocking upgrade — important because that call can hang
  indefinitely on devices/browsers with no platform authenticator, and must not block
  turning the lock on.
- **Caveat**: this is a screen-lock approximation, not full at-rest encryption — the
  underlying `localStorage` data is still stored in plaintext. Real biometric-gated
  encryption of the data itself needs a native shell (Keychain/Keystore-backed storage).

## Not yet built (next steps)

1. **Sync** — encrypted cloud backup (Firebase/Supabase or similar) behind the same
   storage interface used by `app.js`. Left out of this scaffold because it requires the
   project owner's own backend project/credentials to wire up — swapping
   `loadEntries/addEntry/updateEntry` (and the equivalent functions for appointments,
   documents, and check-ins) for calls to that backend's SDK is the intended integration
   point.
2. **True background reminders** — see the Calendar section above; requires a native
   shell or push-backed scheduling to fire without the app open.
3. **Native iOS integration** — `PHPickerViewController` and real Face ID/Touch ID (as
   opposed to the WebAuthn approximation above) require the React Native path described
   at the top of this file.
