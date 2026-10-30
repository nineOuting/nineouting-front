import { useEffect, useId } from 'react';
import Placeholder from './Placeholder';
import styles from './TopConfirm.module.css';

const ICON_SIZE = 16;

interface TopConfirmProps {
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 화면 위 가운데에 뜨는 확인 창 (MSG-033 멤버 제외 등). 확인 버튼은 빨간색 */
export default function TopConfirm({
  title,
  message,
  cancelLabel = '취소',
  confirmLabel,
  onCancel,
  onConfirm,
}: TopConfirmProps) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div role="alertdialog" aria-labelledby={titleId} className={styles.confirm}>
      <div className={styles.texts}>
        <p id={titleId} className={styles.title}>
          <Placeholder size={ICON_SIZE} />
          {title}
        </p>
        <p className={styles.message}>{message}</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.cancel}`} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={`${styles.button} ${styles.danger}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
