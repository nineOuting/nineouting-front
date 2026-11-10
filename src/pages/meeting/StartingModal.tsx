import Dialog from '../../components/Dialog';
import Spinner from '../../components/Spinner';
import styles from './StartingModal.module.css';

/** REQ-076 회의 시작을 준비하는 동안 뜨는 창 (디자인 PreparingDialog). 닫을 수 없다 */
export default function StartingModal() {
  return (
    <Dialog
      title="회의를 준비하고 있어요"
      description="녹음과 실시간 전사를 준비하고 있어요. 잠시만 기다려 주세요"
      hideClose
      closeOnDimClick={false}
      onClose={() => undefined}
    >
      <div className={styles.loading} aria-live="polite">
        <Spinner />
      </div>
    </Dialog>
  );
}
