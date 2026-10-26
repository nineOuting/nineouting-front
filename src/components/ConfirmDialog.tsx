import { useId } from 'react';
import Button from './Button';
import Modal from './Modal';
import Placeholder from './Placeholder';
import styles from './ConfirmDialog.module.css';

const CLOSE_ICON_SIZE = 24;
const MAIN_ICON_SIZE = 48;

interface ConfirmDialogProps {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  /** 삭제처럼 되돌릴 수 없는 일이면 확인 버튼을 빨간색으로 */
  isDanger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 아이콘·제목·설명과 버튼 두 개로 된 확인 창 (회의 생성 중 이탈 등) */
export default function ConfirmDialog({
  title,
  message,
  cancelLabel,
  confirmLabel,
  isDanger,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();

  return (
    <Modal labelledBy={titleId} onClose={onCancel} className={styles.card}>
      <div className={styles.closeRow}>
        <button type="button" className={styles.iconButton} aria-label="닫기" onClick={onCancel}>
          <Placeholder size={CLOSE_ICON_SIZE} />
        </button>
      </div>
      <div className={styles.body}>
        <div className={styles.head}>
          <Placeholder size={MAIN_ICON_SIZE} />
          <div className={styles.texts}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <p className={styles.message}>{message}</p>
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="neutral" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={isDanger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
