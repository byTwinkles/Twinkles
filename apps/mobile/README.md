# Romere's Room — Mobile (Expo / React Native)

Native counterpart to the PWA scaffold in `public/romere/`, started so the spec's
native-only requirements — `PHPickerViewController`, real Face ID/Touch ID, and
background-capable local notifications — have a real path forward instead of the PWA's
best-effort approximations.

## Stack

- **Expo SDK 57** (managed workflow) + **React Native 0.86** + **React 19**, TypeScript.
- **expo-sqlite** for local-first storage — the spec's actual SQLite recommendation,
  where the PWA had to use `localStorage` instead.
- **@react-navigation** bottom tabs, mirroring the PWA's 4-tab shell.
- Later slices will add `expo-image-picker` (native photo/camera picker),
  `expo-local-authentication` (real Face ID/Touch ID), `expo-notifications`
  (background-capable local notifications), and `expo-print`/`expo-sharing` (PDF export)
  — all already listed in `package.json` as dependencies, not yet wired into a screen.

## Project structure

```
apps/mobile/
├── App.tsx                        # Entry point: SafeAreaProvider + RootNavigator
├── app.json                       # Expo config (bundle id, permissions strings)
├── src/
│   ├── theme/colors.ts            # Same palette as the PWA
│   ├── tiles.ts                   # Quick-log tile config + status vocabularies
│   ├── utils/time.ts              # relativeTime / formatClock helpers
│   ├── db/
│   │   ├── database.ts            # expo-sqlite connection + schema
│   │   └── entries.ts             # CRUD for the entries table
│   ├── components/
│   │   ├── Tile.tsx               # Tap / long-press tile, mirrors the PWA's Tile
│   │   └── EditModal.tsx          # Status pills + note, shared by all quick-log tiles
│   ├── screens/
│   │   ├── DashboardScreen.tsx    # Fully implemented (see below)
│   │   ├── CalendarScreen.tsx     # Placeholder — port from public/romere/js/app.js next
│   │   ├── GalleryScreen.tsx      # Placeholder — needs expo-image-picker integration
│   │   └── MedicalScreen.tsx      # Placeholder — needs timeline + expo-print
│   └── navigation/RootNavigator.tsx
```

## What's implemented: Dashboard + one-tap logging

This first native slice intentionally mirrors how the PWA itself was built — Dashboard
and logging first, other tabs stubbed — so the two codebases stay easy to compare.

- **`entries` table** (`src/db/database.ts`): one SQLite table backing all log types
  (diaper, feeding, medication, note, vitals, surgery, plus `foodDiary`/`photo` for when
  those flows are ported), matching the PWA's flat-entries data model.
- **Tap / re-tap / long-press** (`Tile.tsx` + `DashboardScreen.tsx`): tap logs
  immediately with a pink flash; tapping the same tile again within 60 seconds opens
  the edit modal on the just-created entry instead of duplicating it; long-press (500ms,
  using React Native's built-in `onLongPress`/`delayLongPress` rather than a hand-rolled
  timer) opens the same modal as a fresh draft.
- **Today's log list**: reads today's entries from SQLite and renders them below the
  tile grid, same as the PWA's `#entry-list`.

Food Diary and Photo tiles are deliberately left out of `QUICK_LOG_TILES` — they need
their own flows (meal form; `expo-image-picker`) and aren't part of this slice.

## Running it

```bash
cd apps/mobile
npm install
npm run ios       # or: npm start, then press i/a/w
```

`npm run typecheck` runs `tsc --noEmit` — this passes cleanly as of this commit; run it
after any change to the `src/db` or screen files.

## Not yet built (next steps)

1. **Calendar / Gallery / Medical screens** — port the equivalent logic from
   `public/romere/js/app.js`, replacing `localStorage` calls with the `src/db` module's
   SQLite equivalents (a new `appointments.ts`, `documents.ts`, `checkins.ts`).
2. **Native photo picker** — wire `expo-image-picker` into the Gallery/Photo flow in
   place of the PWA's `<input type="file">`.
3. **Real biometric lock** — `expo-local-authentication`'s `authenticateAsync()` in
   place of the PWA's WebAuthn approximation; pair with `expo-secure-store` so the lock
   state (and ideally a data-encryption key) lives in the OS keychain, not SQLite.
4. **Background-capable reminders** — `expo-notifications` scheduled notifications can
   fire without the app open, closing the PWA's biggest reminder limitation.
5. **PDF export** — `expo-print` (`Print.printToFileAsync`) + `expo-sharing` for the
   Medical "Share Report" flow, replacing the PWA's `window.print()`.
6. **Cloud sync** — same caveat as the PWA README: needs the project owner's own
   Firebase/Supabase project and credentials before it can be wired up.
