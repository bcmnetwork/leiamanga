import { getDb } from './client';

// Bump when adding migrations; migrateDatabase() only runs statements for versions above the stored one.
const SCHEMA_VERSION = 3;

export async function migrateDatabase(): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) {
    return;
  }

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS series (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        folder_path TEXT,
        cover_path TEXT,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        source_uri TEXT NOT NULL,
        pages_dir TEXT NOT NULL,
        page_count INTEGER NOT NULL,
        sort_order INTEGER NOT NULL,
        added_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reading_progress (
        chapter_id TEXT PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
        last_page INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  if (currentVersion < 2) {
    await db.execAsync(`
      ALTER TABLE series ADD COLUMN description TEXT;
      ALTER TABLE series ADD COLUMN genre TEXT;
    `);
  }

  if (currentVersion < 3) {
    await db.execAsync(`
      ALTER TABLE series ADD COLUMN author TEXT;
      ALTER TABLE chapters ADD COLUMN downloaded INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE reading_progress ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS read_marks (
        source_key TEXT PRIMARY KEY,
        marked_at INTEGER NOT NULL
      );
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
