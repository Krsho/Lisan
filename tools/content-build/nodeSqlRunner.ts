import { DatabaseSync } from 'node:sqlite';

import type { SqlRunner } from '../../src/content/repository';

/** Opens a content database read-only through node:sqlite, exposing the app's SqlRunner interface. */
export function openSqlRunner(file: string): SqlRunner & { close(): void } {
  const db = new DatabaseSync(file, { readOnly: true });
  return {
    async all<Row>(sql: string, params: (string | number)[]) {
      return db.prepare(sql).all(...params) as Row[];
    },
    close: () => db.close(),
  };
}
