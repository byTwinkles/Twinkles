import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("romere.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          status TEXT,
          note TEXT,
          meal TEXT,
          tag TEXT,
          title TEXT,
          photo_uri TEXT
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export function makeId(): string {
  return "e_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}
