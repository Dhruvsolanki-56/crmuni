import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = readdirSync(resolve(root, 'drizzle'))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');

for (const file of files) {
  const sql = readFileSync(resolve(root, 'drizzle', file), 'utf8');
  for (const statement of sql
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter(Boolean)) {
    try {
      db.exec(statement);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${error.message}`, {
        cause: error,
      });
    }
  }
}

const integrity = db.prepare('PRAGMA integrity_check').get();
if (integrity.integrity_check !== 'ok')
  throw new Error(
    `SQLite integrity check failed: ${integrity.integrity_check}`,
  );
const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
if (foreignKeys.length)
  throw new Error(`Foreign-key check found ${foreignKeys.length} violations.`);
const tables = db
  .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table'")
  .get();
console.log(
  `Verified ${files.length} migrations, ${tables.count} tables, integrity ok, no foreign-key violations.`,
);
db.close();
