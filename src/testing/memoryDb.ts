import { DatabaseSync } from 'node:sqlite';

import type { SqlValue, UserSqlRunner } from '../user/sql';

/** A database in memory through node:sqlite, for tests of the user store. */
export function openMemoryDb(): UserSqlRunner & { close(): void } {
  const db = new DatabaseSync(':memory:');
  return {
    async all<Row>(sql: string, params: SqlValue[]) {
      return db.prepare(sql).all(...params) as Row[];
    },
    async run(sql: string, params: SqlValue[]) {
      return { changes: Number(db.prepare(sql).run(...params).changes) };
    },
    async exec(sql: string) {
      db.exec(sql);
    },
    async transaction<T>(fn: () => Promise<T>) {
      db.exec('BEGIN');
      try {
        const result = await fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
}
