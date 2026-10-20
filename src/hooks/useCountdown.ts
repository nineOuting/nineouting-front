import { useCallback, useEffect, useState } from 'react';

const TICK_MS = 1000;

export function useCountdown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) {
      return undefined;
    }
    const timerId = window.setTimeout(() => setRemaining((value) => value - 1), TICK_MS);
    return () => window.clearTimeout(timerId);
  }, [remaining]);

  const start = useCallback((seconds: number) => setRemaining(seconds), []);

  return { remaining, start };
}

export function formatSeconds(totalSeconds: number, padMinutes = false) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${padMinutes ? String(minutes).padStart(2, '0') : minutes}:${seconds}`;
}
