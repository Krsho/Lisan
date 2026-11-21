import { useCallback, useEffect, useRef, useState } from 'react';

import { CONTENT_SCHEMA, CONTENT_VERSION } from '../version';
import {
  contentDatabaseExists,
  deleteContentDatabase,
  expoContentStore,
  readUpdateStateSync,
  removeStaleContentFiles,
} from './expoContentStore';
import {
  chooseActiveContent,
  parseUpdateState,
  rejectContentVersion,
  type ActiveContent,
} from './policy';
import { checkForContentUpdate } from './updater';

const chooseAtStartup = () =>
  chooseActiveContent(
    CONTENT_VERSION,
    parseUpdateState(readUpdateStateSync()),
    contentDatabaseExists,
  );

/** Remembers that a downloaded version would not open, so it is never downloaded again. */
async function rejectDownload(version: number) {
  const state = parseUpdateState(await expoContentStore.readState());
  await expoContentStore.writeState(JSON.stringify(rejectContentVersion(state, version)));
}

/**
 * The content database to open: the newest verified download, else the bundled one.
 * In the background it removes old content files and checks (at most daily) for newer
 * content, which is installed for the next app start so a session is never interrupted.
 */
export function useActiveContent(): {
  active: ActiveContent;
  /** Whether even the bundled database would not open: the app cannot show any content. */
  failed: boolean;
  /** For SQLiteProvider's onError: falls back to the bundled database if a download won't open. */
  onOpenError: (error: Error) => void;
} {
  const [active, setActive] = useState(chooseAtStartup);
  const [failed, setFailed] = useState(false);
  // Recording a rejected download, which the next update check waits for.
  const rejecting = useRef<Promise<void>>(Promise.resolve());

  const onOpenError = useCallback(
    (error: Error) => {
      // Called while SQLiteProvider renders, so switch on the next tick.
      setTimeout(() => {
        if (active.bundled) {
          console.error(`The bundled content ${active.databaseName} failed to open`, error);
          setFailed(true);
          return;
        }
        console.warn(`Downloaded content ${active.databaseName} failed to open`, error);
        try {
          deleteContentDatabase(active.databaseName);
        } catch {}
        rejecting.current = rejectDownload(active.version).catch((e: unknown) =>
          console.warn('Could not record the content that failed to open', e),
        );
        setActive(chooseActiveContent(CONTENT_VERSION, parseUpdateState(null), () => false));
      });
    },
    [active],
  );

  useEffect(() => {
    (async () => {
      removeStaleContentFiles(active.databaseName);
      await rejecting.current;
      const result = await checkForContentUpdate(expoContentStore, {
        activeVersion: active.version,
        supportedSchema: CONTENT_SCHEMA,
        now: Date.now(),
      });
      if (result.status === 'failed') console.warn('Content update failed:', result.reason);
    })().catch((error: unknown) => console.warn('Content update failed', error));
  }, [active]);

  return { active, failed, onOpenError };
}
