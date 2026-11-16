import { useId, type FormEvent, type ReactNode } from 'react';
import chevronLeftIcon from '../assets/icons/chevron-left.svg';
import closeIcon from '../assets/icons/close.svg';
import Icon from './Icon';
import Modal from './Modal';
import styles from './Dialog.module.css';

const CLOSE_ICON_SIZE = 24;

interface DialogProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** 아래 버튼 줄 (오른쪽 정렬) */
  footer?: ReactNode;
  /** 디자인 Modal 너비: sm 400px, md 560px */
  width?: 'sm' | 'md' | 'lg';
  onClose: () => void;
  /** 넘기면 창 전체를 form으로 감싼다 (Enter로 제출) */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** 닫기(X) 버튼을 숨긴다 (진행 중이라 닫으면 안 될 때) */
  hideClose?: boolean;
  /** 바깥을 누르면 닫는다. 입력 창(onSubmit)은 기본으로 닫지 않는다 (REQ-179) */
  closeOnDimClick?: boolean;
  className?: string;
  /** 넘기면 제목 왼쪽에 뒤로 가기(<)를 둔다 (디자인 Version02 확인 창들) */
  onBack?: () => void;
}

/** 디자인 Modal: 제목, 설명, 닫기 + 내용 + 오른쪽 버튼 줄 */
export default function Dialog({
  title,
  description,
  children,
  footer,
  width = 'sm',
  onClose,
  onSubmit,
  hideClose,
  closeOnDimClick,
  className,
  onBack,
}: DialogProps) {
  const titleId = useId();
  const content = (
    <>
      <div className={styles.header}>
        {onBack && (
          <button type="button" className={styles.back} aria-label="뒤로 가기" onClick={onBack}>
            <Icon src={chevronLeftIcon} size={CLOSE_ICON_SIZE - 4} />
          </button>
        )}
        <div className={styles.titleGroup}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {!hideClose && (
          <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
            <Icon src={closeIcon} size={CLOSE_ICON_SIZE} />
          </button>
        )}
      </div>
      {children && <div className={styles.content}>{children}</div>}
      {footer && <div className={styles.footer}>{footer}</div>}
    </>
  );

  return (
    <Modal
      labelledBy={titleId}
      onClose={onClose}
      closeOnDimClick={closeOnDimClick ?? !onSubmit}
      className={[styles.dialog, styles[width], className].filter(Boolean).join(' ')}
    >
      {onSubmit ? (
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          {content}
        </form>
      ) : (
        content
      )}
    </Modal>
  );
}
