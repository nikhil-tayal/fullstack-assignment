'use client';

import { useEffect, useState } from 'react';

/**
 * Holds a value still until typing stops.
 *
 * The search box filters the whole registry server-side, so firing on every
 * keystroke would put the reader's results permanently one letter behind their
 * input. The box itself stays immediate; only the request waits.
 */
export function useDebounced<T>(value: T, delayMs = 200): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
