import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme/colors';
import { createContentRepository, type ContentRepository, type SqlRunner } from './repository';
import { useActiveContent } from './update/useActiveContent';

const BUNDLED_DATABASE = { assetId: require('../../assets/content/content.db') };

// File names carry the content version (content-vN.db), so a newer bundled database is copied
// in instead of reusing a previous install's copy. A downloaded database (src/content/update)
// is already in place and opens without the asset.
export function ContentProvider({ children }: { children: ReactNode }) {
  const { active, failed, onOpenError } = useActiveContent();
  const colors = useColors();
  if (failed) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, textAlign: 'center' }}>
          Couldn&apos;t open the Quran text. Please restart the app, or reinstall it if this keeps
          happening.
        </Text>
      </View>
    );
  }
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

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
