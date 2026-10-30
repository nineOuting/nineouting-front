import { useId, useState } from 'react';
import Button from '../../components/Button';
import Checkbox from '../../components/Checkbox';
import Modal from '../../components/Modal';
import Placeholder from '../../components/Placeholder';
import styles from './ConsentModal.module.css';

const CLOSE_ICON_SIZE = 24;
const MAIN_ICON_SIZE = 48;

const CONSENT_ITEMS = [
  { title: '회의 음성 녹음', description: '회의 내용을 기록하기 위해 음성을 녹음합니다.' },
  { title: '실시간 전사 및 회의 정리', description: '발언을 텍스트로 변환하고, 논의 내용과 결정사항을 정리합니다.' },
  { title: '데이터 보관', description: '녹음 데이터는 서비스 보관 정책에 따라 일정 기간 후 삭제됩니다.' },
];

interface ConsentModalProps {
  onCancel: () => void;
  onAgree: () => void;
}

/** REQ-077 회의 시작 버튼을 누르면 뜨는 녹음·전사 동의 창. 동의에 체크해야 참여할 수 있다 */
export default function ConsentModal({ onCancel, onAgree }: ConsentModalProps) {
  const titleId = useId();
  const [isAgreed, setIsAgreed] = useState(false);

  return (
    <Modal labelledBy={titleId} onClose={onCancel} className={styles.card}>
      <div className={styles.closeRow}>
        <button type="button" className={styles.iconButton} aria-label="닫기" onClick={onCancel}>
          <Placeholder size={CLOSE_ICON_SIZE} />
        </button>
      </div>
      <div className={styles.body}>
        <div className={styles.content}>
          <Placeholder size={MAIN_ICON_SIZE} />
          <div className={styles.texts}>
            <h2 id={titleId} className={styles.title}>
              회의 녹음 및 전사에 동의해 주세요
            </h2>
            <p className={styles.message}>
              {'회의가 시작되면 음성이 녹음되고\n실시간 텍스트로 변환됩니다.\n전사된 내용은 회의 중 논의를 정리하고\n회의록을 생성하는 데 사용됩니다.'}
            </p>
          </div>
          <ul className={styles.items}>
            {CONSENT_ITEMS.map((item) => (
              <li key={item.title}>
                <p className={styles.itemTitle}>{item.title}</p>
                <p className={styles.itemDescription}>{item.description}</p>
              </li>
            ))}
          </ul>
          <Checkbox className={styles.agree} checked={isAgreed} onChange={(event) => setIsAgreed(event.target.checked)}>
            회의 녹음, 전사 및 AI 회의 정리에 동의합니다.
          </Checkbox>
        </div>
        <div className={styles.actions}>
          <Button variant="neutral" onClick={onCancel}>
            취소
          </Button>
          <Button disabled={!isAgreed} onClick={onAgree}>
            동의하고 참여하기
          </Button>
        </div>
      </div>
    </Modal>
  );
}
