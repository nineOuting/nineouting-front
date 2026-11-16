import { useEffect } from 'react';
import infoIcon from '../assets/icons/info.svg';
import successIcon from '../assets/icons/success.svg';
import Icon from './Icon';
import styles from './Toast.module.css';

// REQ-177 3초 뒤 사라진다. [되돌리기]처럼 할 일이 있으면 5초
const TOAST_DURATION_MS = 3000;
const ACTION_TOAST_DURATION_MS = 5000;
const TOAST_ICON_SIZE = 20;

export interface ToastMessage {
  text: string;
  /** 아이콘 색: info(파랑), success(초록), error(빨강) */
  variant: 'error' | 'info' | 'success';
  /** 되돌리기처럼 토스트 안에서 바로 하는 일 */
  action?: { label: string; onClick: () => void };
}

interface ToastProps {
  message: ToastMessage;
  onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timerId = window.setTimeout(onClose, message.action ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS);
    return () => window.clearTimeout(timerId);
  }, [message, onClose]);

  return (
    <div role={message.variant === 'error' ? 'alert' : 'status'} className={`${styles.toast} ${styles[message.variant]}`}>
      <Icon src={message.variant === 'success' ? successIcon : infoIcon} size={TOAST_ICON_SIZE} className={styles.icon} />
      <p className={styles.text}>{message.text}</p>
      {message.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            message.action?.onClick();
            onClose();
          }}
        >
          {message.action.label}
        </button>
      )}
    </div>
  );
}
