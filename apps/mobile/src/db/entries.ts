import type * as SQLite from "expo-sqlite";
import { getDatabase, makeId } from "./database";

export type EntryType =
  | "diaper"
  | "feeding"
  | "medication"
  | "note"
  | "vitals"
  | "surgery"
  | "foodDiary"
  | "photo";

export interface Entry {
  id: string;
  type: EntryType;
  timestamp: string;
  status?: string;
  note?: string;
  meal?: string;
  tag?: string;
  title?: string;
  photoUri?: string;
}

interface EntryRow {
  id: string;
  type: EntryType;
  timestamp: string;
  status: string | null;
  note: string | null;
  meal: string | null;
  tag: string | null;
  title: string | null;
  photo_uri: string | null;
}

function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    type: row.type,
    timestamp: row.timestamp,
    status: row.status ?? undefined,
    note: row.note ?? undefined,
    meal: row.meal ?? undefined,
    tag: row.tag ?? undefined,
    title: row.title ?? undefined,
    photoUri: row.photo_uri ?? undefined
  };
}

export async function addEntry(entry: Omit<Entry, "id"> & { id?: string }): Promise<Entry> {
  const db = await getDatabase();
  const id = entry.id ?? makeId();
  await db.runAsync(
    `INSERT INTO entries (id, type, timestamp, status, note, meal, tag, title, photo_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    entry.type,
    entry.timestamp,
    entry.status ?? null,
    entry.note ?? null,
    entry.meal ?? null,
    entry.tag ?? null,
    entry.title ?? null,
    entry.photoUri ?? null
  );
  return { ...entry, id };
}

export async function updateEntry(id: string, patch: Partial<Omit<Entry, "id">>): Promise<void> {
  const db = await getDatabase();
  const columnMap: Record<string, string> = { photoUri: "photo_uri" };
  const fields = Object.keys(patch);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${columnMap[f] ?? f} = ?`).join(", ");
  const values: SQLite.SQLiteBindValue[] = fields.map((f) => (patch as Record<string, unknown>)[f] as SQLite.SQLiteBindValue ?? null);
  await db.runAsync(`UPDATE entries SET ${setClause} WHERE id = ?`, ...values, id);
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM entries WHERE id = ?`, id);
}

export async function lastEntryOfType(type: EntryType): Promise<Entry | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<EntryRow>(
    `SELECT * FROM entries WHERE type = ? ORDER BY timestamp DESC LIMIT 1`,
    type
  );
  return row ? rowToEntry(row) : null;
}

export async function entriesForToday(): Promise<Entry[]> {
  const db = await getDatabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entries WHERE timestamp >= ? ORDER BY timestamp DESC`,
    startOfDay.toISOString()
  );
  return rows.map(rowToEntry);
}

export async function entriesByType(type: EntryType): Promise<Entry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entries WHERE type = ? ORDER BY timestamp DESC`,
    type
  );
  return rows.map(rowToEntry);
}
