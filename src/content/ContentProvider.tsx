import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useMemo, type ReactNode } from 'react';

import { createContentRepository, type ContentRepository, type SqlRunner } from './repository';
import { useActiveContent } from './update/useActiveContent';

const BUNDLED_DATABASE = { assetId: require('../../assets/content/content.db') };

// File names carry the content version (content-vN.db), so a newer bundled database is copied
// in instead of reusing a previous install's copy. A downloaded database (src/content/update)
// is already in place and opens without the asset.
export function ContentProvider({ children }: { children: ReactNode }) {
  const { active, onOpenError } = useActiveContent();
  return (
    <SQLiteProvider
      key={active.databaseName}
      databaseName={active.databaseName}
      assetSource={active.bundled ? BUNDLED_DATABASE : undefined}
      onError={onOpenError}
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
