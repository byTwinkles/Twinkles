import type { EntryType } from "./db/entries";

export interface TileConfig {
  key: EntryType;
  icon: string;
  label: string;
}

// Food Diary and Photo have their own multi-step flows (native picker, meal form)
// and aren't part of this first native slice — see apps/mobile/README.md.
export const QUICK_LOG_TILES: TileConfig[] = [
  { key: "diaper", icon: "🧷", label: "Diaper" },
  { key: "feeding", icon: "🍼", label: "Feeding" },
  { key: "medication", icon: "💊", label: "Medication" },
  { key: "note", icon: "📝", label: "Note" },
  { key: "vitals", icon: "❤️", label: "Vitals" },
  { key: "surgery", icon: "🏥", label: "Surgery/Recovery" }
];

export const STATUS_OPTIONS: Partial<Record<EntryType, string[]>> = {
  diaper: ["normal", "wet", "soiled", "both"],
  feeding: ["normal", "low intake", "refused", "great"],
  medication: ["given", "missed", "refused"],
  vitals: ["normal", "watch", "concerning"],
  surgery: ["stable", "improving", "needs attention"]
};

export function tileFor(type: EntryType): TileConfig {
  return QUICK_LOG_TILES.find((t) => t.key === type) ?? { key: type, icon: "•", label: type };
}
