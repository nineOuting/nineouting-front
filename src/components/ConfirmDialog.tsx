import { useId, type ReactNode } from 'react';
import Button from './Button';
import Modal from './Modal';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  /** 삭제처럼 되돌릴 수 없는 일이면 확인 버튼을 빨간색으로 */
  isDanger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Esc로 닫을 때. 없으면 onCancel (왼쪽 버튼이 "나가기"처럼 되돌릴 수 없는 일이면 넘긴다) */
  onDismiss?: () => void;
  /** 설명 아래에 넣을 내용 (워크스페이스 삭제의 이름 확인 칸 등) */
  children?: ReactNode;
  /** 확인 버튼을 막는다 (확인 칸을 다 채우기 전) */
  isConfirmDisabled?: boolean;
}

/** 제목, 설명과 버튼 두 개로 된 확인 창 (디자인 11 나가기, 삭제 확인) */
export default function ConfirmDialog({
  title,
  message,
  cancelLabel,
  confirmLabel,
  isDanger,
  onCancel,
  onConfirm,
  onDismiss,
  children,
  isConfirmDisabled,
}: ConfirmDialogProps) {
  const titleId = useId();

  return (
    <Modal labelledBy={titleId} onClose={onDismiss ?? onCancel} className={styles.card}>
      <div className={styles.texts}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>{message}</p>
      </div>
      {children}
      <div className={styles.actions}>
        <Button variant="secondary" size="md" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={isDanger ? 'danger' : 'primary'} size="md" disabled={isConfirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
