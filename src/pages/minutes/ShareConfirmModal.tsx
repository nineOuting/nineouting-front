import Modal from '../../components/Modal';
import Placeholder from '../../components/Placeholder';
import styles from './MinutesModal.module.css';

const TITLE_ICON_SIZE = 24;
const BUTTON_ICON_SIZE = 16;

interface ShareConfirmModalProps {
  isSharing: boolean;
  onShare: () => void;
  onClose: () => void;
}

/** REQ-136 작성 완료 확인 (디자인 23:684, MSG-036) */
export default function ShareConfirmModal({ isSharing, onShare, onClose }: ShareConfirmModalProps) {
  return (
    <Modal labelledBy="share-title" onClose={onClose} className={`${styles.modal} ${styles.narrow}`}>
      <div className={styles.head}>
        <h2 id="share-title" className={styles.title}>
          <Placeholder size={TITLE_ICON_SIZE} />
          회의록을 저장하고 공유할까요?
        </h2>
        <p className={styles.description}>
          저장하면 이번 회의에 참여한 멤버들에게 회의록이 바로 공유돼요. 내용을 확인한 후 진행해 주세요.
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          계속 수정
        </button>
        <button type="button" className={styles.primary} disabled={isSharing} onClick={onShare}>
          <Placeholder size={BUTTON_ICON_SIZE} />
          저장하고 공유
        </button>
      </div>
    </Modal>
  );
}
