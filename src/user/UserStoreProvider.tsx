import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { EventDraft, ReviewEvent } from '../engine';
import { SettingsProvider } from '../settings/SettingsContext';
import { parseSettings, serializeSettings, type ReadingSettings } from '../settings/settings';
import { useColors } from '../theme/colors';
import { migrateUserDb } from './migrations';
import type { UserSqlRunner } from './sql';
import { createUserStore, type UserStore } from './store';

/**
 * The writable user database. Its name is fixed: unlike the content database it is never copied
 * from an asset or replaced by a content update. It is opened here rather than through a second
 * SQLiteProvider, which would hide the content database from everything below it.
 */
const USER_DATABASE_NAME = 'user.db';

function runnerFor(db: SQLiteDatabase): UserSqlRunner {
  return {
    all: (sql, params) => db.getAllAsync(sql, params),
    run: (sql, params) => db.runAsync(sql, params),
    exec: (sql) => db.execAsync(sql),
    async transaction(fn) {
      let result!: Awaited<ReturnType<typeof fn>>;
      await db.withTransactionAsync(async () => {
        result = await fn();
      });
      return result;
    },
  };
}

let opening: Promise<UserStore> | null = null;

/**
 * Opens and migrates the user database once for the app's lifetime (it stays open), so remounts
 * never run two migrations at the same time.
 */
function openUserStore(): Promise<UserStore> {
  opening ??= (async () => {
    const db = await openDatabaseAsync(USER_DATABASE_NAME);
    // WAL cannot be switched on inside a transaction, so before migrating.
    await db.execAsync('PRAGMA journal_mode = WAL');
    const runner = runnerFor(db);
    await migrateUserDb(runner);
    const store = createUserStore(runner, randomUUID);
    await store.getDeviceId();
    return store;
  })().catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

type EventLog = {
  /** The whole log, oldest first; updated as events are recorded. */
  events: ReviewEvent[];
  /** Appends events from this device to the log. */
  record(drafts: EventDraft[]): Promise<void>;
};

const EventLogContext = createContext<EventLog | null>(null);

type State =
  | { status: 'opening' }
  | { status: 'failed' }
  | { status: 'open'; store: UserStore; events: ReviewEvent[]; settings: ReadingSettings };

/** Opens and migrates the user database, then provides the event log and settings to the app. */
export function UserStoreProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const [state, setState] = useState<State>({ status: 'opening' });

  useEffect(() => {
    let cancelled = false;
    openUserStore()
      .then(async (store) => {
        const [events, settingRows] = await Promise.all([store.listEvents(), store.listSettings()]);
        const settings = parseSettings(settingRows);
        if (!cancelled) setState({ status: 'open', store, events, settings });
      })
      .catch((error: unknown) => {
        console.error('Failed to open the user database', error);
        if (!cancelled) setState({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const store = state.status === 'open' ? state.store : null;
  const record = useCallback(
    async (drafts: EventDraft[]) => {
      if (!store) throw new Error('The user database is not open');
      const recorded = await store.record(drafts);
      setState((s) => (s.status === 'open' ? { ...s, events: [...s.events, ...recorded] } : s));
    },
    [store],
  );
  const events = state.status === 'open' ? state.events : null;
  const log = useMemo(() => (events ? { events, record } : null), [events, record]);

  const updateSettings = useCallback(
    (patch: Partial<ReadingSettings>) => {
      // Shown at once; written in the background, since settings are cheap to set again.
      setState((s) => (s.status === 'open' ? { ...s, settings: { ...s.settings, ...patch } } : s));
      store
        ?.saveSettings(serializeSettings(patch), Date.now())
        .catch((error: unknown) => console.error('Failed to save settings', error));
    },
    [store],
  );
  const settings = state.status === 'open' ? state.settings : null;
  const settingsValue = useMemo(
    () => (settings ? { settings, update: updateSettings } : null),
    [settings, updateSettings],
  );

  if (!log || !settingsValue) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        {state.status === 'failed' ? (
          <Text style={{ color: colors.text }}>Couldn&apos;t open your progress.</Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }
  return (
    <SettingsProvider value={settingsValue}>
      <EventLogContext.Provider value={log}>{children}</EventLogContext.Provider>
    </SettingsProvider>
  );
}

export function useEventLog(): EventLog {
  const log = useContext(EventLogContext);
  if (!log) throw new Error('useEventLog must be used inside UserStoreProvider');
  return log;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
