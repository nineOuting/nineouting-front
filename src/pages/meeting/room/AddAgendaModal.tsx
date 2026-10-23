import { useId, useState, type FormEvent } from 'react';
import Modal from '../../../components/Modal';
import Placeholder from '../../../components/Placeholder';
import TextField from '../../../components/TextField';
import room from './room.module.css';
import styles from './AddAgendaModal.module.css';

const ICON_SIZE = 20;
// meeting-service AddAgendaRequest 길이 제한과 같다
const TITLE_MAX_LENGTH = 100;
const DECISION_MAX_LENGTH = 500;
// MSG-029
const EMPTY_TITLE_MESSAGE = '안건 제목을 입력해 주세요.';

interface AddAgendaModalProps {
  onCancel: () => void;
  onAdd: (title: string, decisionPoint: string) => void;
}

/** REQ-090 회의 중 안건 추가. 안건 제목만 필수 */
export default function AddAgendaModal({ onCancel, onAdd }: AddAgendaModalProps) {
  const titleId = useId();
  const [title, setTitle] = useState('');
  const [decisionPoint, setDecisionPoint] = useState('');
  const [titleError, setTitleError] = useState<string>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError(EMPTY_TITLE_MESSAGE);
      return;
    }
    onAdd(title.trim(), decisionPoint.trim());
  };

  return (
    <Modal labelledBy={titleId} onClose={onCancel} className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.head}>
          <Placeholder size={ICON_SIZE} />
          <h2 id={titleId} className={styles.headTitle}>
            새 안건 작성
          </h2>
        </div>
        <TextField
          label="안건 제목 *"
          className={styles.field}
          placeholder="예 : 핵심 기능 우선순위 결정"
          maxLength={TITLE_MAX_LENGTH}
          value={title}
          error={titleError}
          autoFocus
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError(undefined);
          }}
          trailing={<Placeholder size={ICON_SIZE} />}
        />
        <div className={styles.decisionGroup}>
          <TextField
            label="결정할 내용"
            className={styles.field}
            placeholder="이 안건에서 무엇을 결정해야 하나요?"
            maxLength={DECISION_MAX_LENGTH}
            value={decisionPoint}
            onChange={(event) => setDecisionPoint(event.target.value)}
            trailing={<Placeholder size={ICON_SIZE} />}
          />
          <p className={styles.hint}>예 : 1차 개발에 포함할 기능 3개를 확정한다.</p>
        </div>
        <div className={room.pillRow}>
          <button type="button" className={`${room.pill} ${room.pillOutline}`} onClick={onCancel}>
            취소
          </button>
          <button type="submit" className={`${room.pill} ${room.pillPrimary}`}>
            안건 추가
          </button>
        </div>
      </form>
    </Modal>
  );
}
