import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

interface ModalProps {
  children: ReactNode;
  labelledBy: string;
  onClose?: () => void;
  /** 로딩처럼 뒤 화면을 흐리게만 보여 줄 때는 light */
  dim?: 'strong' | 'light';
  closeOnDimClick?: boolean;
  className?: string;
}

/**
 * 어두운 배경 위에 뜨는 창. Esc를 누르면 onClose를 부른다.
 * body에 바로 그린다: 사이드바(position: sticky)처럼 쌓임 순서를 따로 갖는 곳에서 열어도 본문 뒤에 가려지지 않게
 */
export default function Modal({
  children,
  labelledBy,
  onClose,
  dim = 'strong',
  closeOnDimClick = false,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!onClose) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className={`${styles.dim} ${styles[dim]}`}
      onClick={(event) => {
        if (closeOnDimClick && event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={[styles.card, className].filter(Boolean).join(' ')}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
