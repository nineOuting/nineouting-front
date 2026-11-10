import { useEffect, useState } from 'react';
import errorIcon from '../assets/icons/error.svg';
import Icon from './Icon';
import styles from './OfflineBanner.module.css';

const ICON_SIZE = 16;

/**
 * REQ-082 회의 중 인터넷이 끊기면 맨 위에 빨간 줄로 알린다 (MSG-069, 디자인 NetworkOfflinePage).
 * 끊긴 동안의 소리는 SttStream이 최대 10분까지 모아 두었다가 다시 연결되면 보낸다
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!isOffline) {
    return null;
  }
  return (
    <p className={styles.banner} role="alert">
      <Icon src={errorIcon} size={ICON_SIZE} />
      인터넷 연결이 끊겼어요. 녹음은 계속되고, 다시 연결되면 자동으로 올려요.
    </p>
  );
}
