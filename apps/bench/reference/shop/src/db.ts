// The one SQLite connection. Every module creates and uses only its own tables.
import Database from 'better-sqlite3';

export const db = new Database(process.env.DATABASE_PATH ?? 'shop.sqlite');
db.pragma('journal_mode = WAL');

export const now = (): string => new Date().toISOString();
