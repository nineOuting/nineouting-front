import type { TermsBlock, TermsContent } from '../constants/terms';
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
        {terms.sections.map((section, index) => (
          <section key={section.title || index} className={styles.section}>
            {section.title && <p className={styles.sectionTitle}>{section.title}</p>}
            {section.body.map((block, blockIndex) => (
              <Block key={blockIndex} block={block} />
            ))}
          </section>
        ))}
      </div>
    </Dialog>
  );
}

function Block({ block }: { block: TermsBlock }) {
  if (typeof block === 'string') {
    return <p>{block}</p>;
  }
  // 열이 많은 표(국외 이전)는 창 안에서 옆으로 넘겨 본다
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {block.head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join('|')}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
