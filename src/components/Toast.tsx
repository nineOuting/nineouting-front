import { useEffect } from 'react';
import Placeholder from './Placeholder';
import styles from './Toast.module.css';

const TOAST_DURATION_MS = 3000;
const TOAST_ICON_SIZE = 20;

export interface ToastMessage {
  text: string;
  variant: 'error' | 'info';
}

interface ToastProps {
  message: ToastMessage;
  onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timerId = window.setTimeout(onClose, TOAST_DURATION_MS);
    return () => window.clearTimeout(timerId);
  }, [message, onClose]);

  return (
    <div role={message.variant === 'error' ? 'alert' : 'status'} className={`${styles.toast} ${styles[message.variant]}`}>
      <Placeholder size={TOAST_ICON_SIZE} variant="toast" />
      <p className={styles.text}>{message.text}</p>
    </div>
  );
}
