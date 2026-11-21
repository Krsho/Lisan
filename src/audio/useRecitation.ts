import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SurahDownloadState } from './downloads';
import type { AudioSource, AyahRef } from './source';
import { ayahAudioUri, downloadSurah, getSurahDownloadState, removeSurahDownload } from './storage';

const sameAyah = (a: AyahRef | null, b: AyahRef) =>
  a !== null && a.surah === b.surah && a.ayah === b.ayah;

export type AyahPlayback = {
  /** Whether this ayah is the one loaded in the player. */
  isCurrent(ref: AyahRef): boolean;
  playing: boolean;
  buffering: boolean;
  error: string | null;
  /** Plays the ayah, or pauses it if it is already playing. */
  toggle(ref: AyahRef): void;
};

/**
 * One player for a screen: plays one ayah at a time, from the downloaded file if there is one,
 * otherwise streamed. Released when the screen unmounts.
 */
export function useAyahPlayback(source: AudioSource): AyahPlayback {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [current, setCurrent] = useState<AyahRef | null>(null);

  const toggle = useCallback(
    (ref: AyahRef) => {
      if (!sameAyah(current, ref)) {
        setCurrent(ref);
        player.replace(ayahAudioUri(source, ref));
        player.play();
      } else if (status.playing) {
        player.pause();
      } else {
        const ended = status.duration > 0 && status.currentTime >= status.duration - 0.05;
        if (ended || status.didJustFinish)
          player
            .seekTo(0)
            .then(() => player.play())
            .catch((error: unknown) => console.warn('Could not replay the recitation', error));
        else player.play();
      }
    },
    [current, player, source, status],
  );

  return {
    isCurrent: (ref) => sameAyah(current, ref),
    playing: status.playing,
    buffering: status.isBuffering,
    error: status.error,
    toggle,
  };
}

export type SurahDownload = {
  state: SurahDownloadState;
  status: 'idle' | 'downloading' | 'failed';
  start(): void;
  cancel(): void;
  remove(): void;
};

/** The user's offline download of a surah's recitation. */
export function useSurahDownload(
  source: AudioSource,
  surah: number,
  ayahCount: number,
): SurahDownload {
  const read = useCallback(
    () => getSurahDownloadState(source.reciter, surah, ayahCount),
    [source, surah, ayahCount],
  );
  const [state, setState] = useState(read);
  const [status, setStatus] = useState<SurahDownload['status']>('idle');
  const running = useRef<AbortController | null>(null);

  // A surah screen is mounted per surah, so the state read on mount stays this surah's.
  useEffect(() => () => running.current?.abort(), []);

  const start = useCallback(() => {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setStatus('downloading');
    downloadSurah(source, surah, ayahCount, { onProgress: setState, signal: controller.signal })
      .then(
        () => setStatus('idle'),
        (error: unknown) => {
          if (controller.signal.aborted) setStatus('idle');
          else {
            console.warn('Audio download failed', surah, error);
            setStatus('failed');
          }
        },
      )
      .finally(() => {
        running.current = null;
        setState(read());
      });
  }, [source, surah, ayahCount, read]);

  const cancel = useCallback(() => running.current?.abort(), []);

  const remove = useCallback(() => {
    running.current?.abort();
    removeSurahDownload(source.reciter, surah);
    setState(read());
    setStatus('idle');
  }, [source, surah, read]);

  return { state, status, start, cancel, remove };
}
