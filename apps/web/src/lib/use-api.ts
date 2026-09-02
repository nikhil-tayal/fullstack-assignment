'use client';

import { useCallback, useEffect, useState } from 'react';
import { NetworkError, apiFetch } from './api';

export interface ApiState<T> {
  data: T | null;
  /** Written for the reader, never a raw status code. */
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Reads one endpoint and re-reads it whenever `path` changes.
 *
 * Both pages drive their filters through the query string, so a filter change is
 * a new path and nothing else needs to coordinate. The previous response is kept
 * on screen while the next one loads: filtering a list that blanks out on every
 * keystroke is harder to use than one that dims.
 */
export function useApi<T>(path: string): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;

    setLoading(true);
    apiFetch<T>(path, { signal: controller.signal })
      .then((next) => {
        if (!live) return;
        setData(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        // An aborted request is a filter that moved on, not a failure to report.
        if (!live || controller.signal.aborted) return;
        setError(
          cause instanceof NetworkError
            ? 'The registry could not be reached. Check that the API is running, then try again.'
            : cause instanceof Error
              ? cause.message
              : 'The registry could not be read.',
        );
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [path, attempt]);

  return { data, error, loading, reload };
}
