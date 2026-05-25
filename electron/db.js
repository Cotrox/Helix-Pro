import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { app } from 'electron';

const COLLECTIONS = {
  shooters: 'shooters',
  sessions: 'sessions',
  tournaments: 'tournaments'
};

const sanitizeFileName = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'helix-pro';

export function createDatabase(projectName) {
  const userDataPath = app.getPath('userData');
  fs.mkdirSync(userDataPath, { recursive: true });

  const dbPath = path.join(userDataPath, `${sanitizeFileName(projectName)}.sqlite3`);
  const database = new DatabaseSync(dbPath);

  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS shooters (
      sort_index INTEGER NOT NULL,
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sort_index INTEGER NOT NULL,
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      sort_index INTEGER NOT NULL,
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );
  `);

  const readCollection = (collectionName) => {
    const tableName = COLLECTIONS[collectionName];
    if (!tableName) {
      throw new Error(`Unsupported collection: ${collectionName}`);
    }

    const rows = database.prepare(`SELECT payload FROM ${tableName} ORDER BY sort_index ASC`).all();
    return rows.map((row) => JSON.parse(row.payload));
  };

  const writeCollection = (collectionName, items) => {
    const tableName = COLLECTIONS[collectionName];
    if (!tableName) {
      throw new Error(`Unsupported collection: ${collectionName}`);
    }

    try {
      database.exec('BEGIN TRANSACTION');

      database.prepare(`DELETE FROM ${tableName}`).run();
      const insertStatement = database.prepare(
        `INSERT OR REPLACE INTO ${tableName} (sort_index, id, payload) VALUES (?, ?, ?)`
      );

      const records = Array.isArray(items) ? items : [];
      records.forEach((item, index) => {
        insertStatement.run(index, item?.id ?? `${collectionName}-${index}`, JSON.stringify(item));
      });

      database.exec('COMMIT');
      return { success: true };
    } catch (error) {
      database.exec('ROLLBACK');
      console.error(`Transaction failed for ${collectionName}:`, error);
      throw error;
    }
  };

  return {
    readCollection,
    writeCollection,
    close: () => database.close()
  };
}