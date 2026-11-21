import { useCallback, useEffect, useState } from 'react';

import { CONTENT_SCHEMA, CONTENT_VERSION } from '../version';
import {
  contentDatabaseExists,
  deleteContentDatabase,
  expoContentStore,
  readUpdateStateSync,
  removeStaleContentFiles,
} from './expoContentStore';
import { chooseActiveContent, parseUpdateState, type ActiveContent } from './policy';
import { checkForContentUpdate } from './updater';

const chooseAtStartup = () =>
  chooseActiveContent(
    CONTENT_VERSION,
    parseUpdateState(readUpdateStateSync()),
    contentDatabaseExists,
  );

/**
 * The content database to open: the newest verified download, else the bundled one.
 * In the background it removes old content files and checks (at most daily) for newer
 * content, which is installed for the next app start so a session is never interrupted.
 */
export function useActiveContent(): {
  active: ActiveContent;
  /** For SQLiteProvider's onError: falls back to the bundled database if a download won't open. */
  onOpenError: (error: Error) => void;
} {
  const [active, setActive] = useState(chooseAtStartup);

  const onOpenError = useCallback(
    (error: Error) => {
      if (active.bundled) throw error;
      // Called while SQLiteProvider renders, so switch on the next tick.
      setTimeout(() => {
        console.warn(`Downloaded content ${active.databaseName} failed to open`, error);
        try {
          deleteContentDatabase(active.databaseName);
        } catch {}
        setActive(chooseActiveContent(CONTENT_VERSION, parseUpdateState(null), () => false));
      });
    },
    [active],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      removeStaleContentFiles(active.databaseName);
      if (cancelled) return;
      const result = await checkForContentUpdate(expoContentStore, {
        activeVersion: active.version,
        supportedSchema: CONTENT_SCHEMA,
        now: Date.now(),
      });
      if (result.status === 'failed') console.warn('Content update failed:', result.reason);
    })().catch((error: unknown) => console.warn('Content update failed', error));
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { active, onOpenError };
}
