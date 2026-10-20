import { useEffect, useId } from 'react';
import type { TermsContent } from '../constants/terms';
import Placeholder from './Placeholder';
import styles from './TermsModal.module.css';

const CLOSE_ICON_SIZE = 40;

interface TermsModalProps {
  terms: TermsContent;
  onClose: () => void;
}

/** 회원가입 → 약관 "보기" 클릭 시 표시. 오른쪽 위 X 버튼으로 회원가입 화면으로 돌아간다 */
export default function TermsModal({ terms, onClose }: TermsModalProps) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.dim}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              {terms.title}
            </h2>
            <p className={styles.description}>{terms.description}</p>
          </div>
          <button type="button" className={styles.close} aria-label="닫기" onClick={onClose} autoFocus>
            <Placeholder size={CLOSE_ICON_SIZE} className={styles.closeIcon} />
          </button>
        </div>
        <div className={styles.body}>
          {terms.sections.map((section) => (
            <section key={section.title}>
              <p>{section.title}</p>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
