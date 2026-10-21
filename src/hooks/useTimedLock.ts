import { useCallback, useEffect, useRef, useState } from 'react';

const MS_PER_SECOND = 1000;

/** 서버가 일정 시간 막은 동작(로그인·인증 5회 실패)을 화면에서도 그 시간 동안 막는다. 풀리면 onExpire를 부른다 */
export function useTimedLock(onExpire?: () => void) {
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (lockedUntil === null) {
      return undefined;
    }
    const timerId = window.setTimeout(() => {
      setLockedUntil(null);
      onExpireRef.current?.();
    }, lockedUntil - Date.now());
    return () => window.clearTimeout(timerId);
  }, [lockedUntil]);

  const lock = useCallback((seconds: number) => setLockedUntil(Date.now() + seconds * MS_PER_SECOND), []);

  return { isLocked: lockedUntil !== null, lock };
}
