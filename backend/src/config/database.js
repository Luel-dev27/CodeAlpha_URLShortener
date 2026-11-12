import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";

function createDatabase(
  databasePath = process.env.DATABASE_PATH ||
    fileURLToPath(new URL("../../data/urls.sqlite", import.meta.url)),
) {
  if (databasePath !== ":memory:")
    fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  const db = new Database(databasePath);
  try {
    db.pragma("busy_timeout = 5000");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(`CREATE TABLE IF NOT EXISTS urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_url TEXT NOT NULL,
      short_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      clicks INTEGER NOT NULL DEFAULT 0 CHECK (clicks >= 0)
    )`);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export { createDatabase };
