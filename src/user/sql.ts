export type SqlValue = string | number | null;

/**
 * Read-write SQL access to the user database, so the store works over expo-sqlite (app) and
 * node:sqlite (tests) alike.
 */
export type UserSqlRunner = {
  all<Row>(sql: string, params: SqlValue[]): Promise<Row[]>;
  run(sql: string, params: SqlValue[]): Promise<{ changes: number }>;
  /** Runs one or more statements without parameters (schema changes). */
  exec(sql: string): Promise<void>;
  /** Runs `fn` in a transaction, rolling back if it throws. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
};
