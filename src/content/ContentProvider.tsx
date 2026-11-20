import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useMemo, type ReactNode } from 'react';

import { createContentRepository, type ContentRepository, type SqlRunner } from './repository';
import { CONTENT_VERSION } from './version';

// The file name carries the content version, so a newer bundled database is copied in
// instead of the app reusing the copy from a previous install.
const DATABASE_NAME = `content-v${CONTENT_VERSION}.db`;

export function ContentProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      assetSource={{ assetId: require('../../assets/content/content.db') }}
    >
      {children}
    </SQLiteProvider>
  );
}

export function useContent(): ContentRepository {
  const db = useSQLiteContext();
  return useMemo(() => {
    const runner: SqlRunner = { all: (sql, params) => db.getAllAsync(sql, params) };
    return createContentRepository(runner);
  }, [db]);
}
