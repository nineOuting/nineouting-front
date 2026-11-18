import { useEffect } from 'react';
import infoIcon from '../assets/icons/info.svg';
import successIcon from '../assets/icons/success.svg';
import Icon from './Icon';
import styles from './Toast.module.css';

// REQ-177 3초 뒤 사라진다. [되돌리기]처럼 할 일이 있으면 5초. 회의 중 화면(위쪽)은 4초
const TOAST_DURATION_MS = 3000;
const TOP_TOAST_DURATION_MS = 4000;
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
  /**
   * REQ-177 (2026-11-17 시트): 기본은 화면 아래 가운데. 회의 중 화면은 아래에 녹음 바가 있어 위쪽 가운데(top)에 4초
   */
  position?: 'bottom' | 'top';
}

export default function Toast({ message, onClose, position = 'bottom' }: ToastProps) {
  useEffect(() => {
    // REQ-177 회의 중 화면(위 가운데)은 [되돌리기]가 있어도 4초 (MSG-120)
    const duration = position === 'top' ? TOP_TOAST_DURATION_MS : message.action ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS;
    const timerId = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timerId);
  }, [message, onClose, position]);

  return (
    <div
      role={message.variant === 'error' ? 'alert' : 'status'}
      className={`${styles.toast} ${styles[position]} ${styles[message.variant]}`}
    >
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
