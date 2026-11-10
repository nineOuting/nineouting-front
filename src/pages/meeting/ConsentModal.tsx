import { useState } from 'react';
import Button from '../../components/Button';
import Checkbox from '../../components/Checkbox';
import Dialog from '../../components/Dialog';
import styles from './ConsentModal.module.css';

const CONSENT_ITEMS = [
  { title: '회의 음성 녹음', description: '회의 내용을 기록하기 위해 음성을 녹음해요' },
  { title: '실시간 전사와 회의 정리', description: '발언을 텍스트로 바꾸고 논의 내용과 결정 사항을 정리해요' },
  { title: '데이터 보관', description: '녹음 원본은 30일 뒤 자동으로 삭제돼요' },
];

interface ConsentModalProps {
  onCancel: () => void;
  onAgree: () => void;
}

/** REQ-077 회의 시작 버튼을 누르면 뜨는 녹음, 전사 동의 창 (디자인 RecordingConsentModal). 동의에 체크해야 참여할 수 있다 */
export default function ConsentModal({ onCancel, onAgree }: ConsentModalProps) {
  const [isAgreed, setIsAgreed] = useState(false);

  return (
    <Dialog
      title="회의 녹음과 전사에 동의해 주세요"
      description="회의가 시작되면 음성이 녹음되고 실시간으로 텍스트로 바뀌어요"
      width="md"
      closeOnDimClick={false}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onCancel}>
            취소
          </Button>
          <Button size="md" disabled={!isAgreed} onClick={onAgree}>
            동의하고 참여하기
          </Button>
        </>
      }
    >
      <ul className={styles.items}>
        {CONSENT_ITEMS.map((item) => (
          <li key={item.title} className={styles.item}>
            <p className={styles.itemTitle}>{item.title}</p>
            <p className={styles.itemDescription}>{item.description}</p>
          </li>
        ))}
      </ul>
      <Checkbox className={styles.agree} checked={isAgreed} onChange={(event) => setIsAgreed(event.target.checked)}>
        회의 녹음, 전사 및 AI 회의 정리에 동의해요
      </Checkbox>
    </Dialog>
  );
}
