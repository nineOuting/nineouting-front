import type { TermsContent } from '../constants/terms';
import Dialog from './Dialog';
import styles from './TermsModal.module.css';

interface TermsModalProps {
  terms: TermsContent;
  onClose: () => void;
}

/** 회원가입 → 약관 "보기" 클릭 시 표시. 오른쪽 위 X 버튼으로 회원가입 화면으로 돌아간다 */
export default function TermsModal({ terms, onClose }: TermsModalProps) {
  return (
    <Dialog title={terms.title} description={terms.description} width="lg" onClose={onClose}>
      <div className={styles.body}>
        {terms.sections.map((section) => (
          <section key={section.title}>
            <p className={styles.sectionTitle}>{section.title}</p>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </Dialog>
  );
}
