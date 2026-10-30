import { useId } from 'react';
import Modal from '../../components/Modal';
import styles from './StartingModal.module.css';

/** REQ-076 회의 시작을 준비하는 동안 뜨는 로딩 창 */
export default function StartingModal() {
  const titleId = useId();

  return (
    <Modal labelledBy={titleId} dim="light" className={styles.card}>
      <div className={styles.content} aria-live="polite">
        {/* 로딩 표시는 디자인에서 자리만 잡혀 있어 같은 크기로 돌아가는 원을 그렸다 */}
        <span className={styles.spinner} aria-hidden="true" />
        <div className={styles.texts}>
          <h2 id={titleId} className={styles.title}>
            회의를 준비하고 있어요
          </h2>
          <p className={styles.message}>녹음과 실시간 전사를 준비하고 있어요.</p>
        </div>
      </div>
    </Modal>
  );
}
