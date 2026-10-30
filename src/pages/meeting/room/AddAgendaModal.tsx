import { useId, useState, type FormEvent } from 'react';
import Modal from '../../../components/Modal';
import Placeholder from '../../../components/Placeholder';
import TextField from '../../../components/TextField';
import { cleanDecisionPoints } from '../../../constants/meeting';
import DecisionPointFields from '../DecisionPointFields';
import room from './room.module.css';
import styles from './AddAgendaModal.module.css';

const ICON_SIZE = 20;
// meeting-service AddAgendaRequest 길이 제한과 같다
const TITLE_MAX_LENGTH = 100;
// MSG-029
const EMPTY_TITLE_MESSAGE = '안건 제목을 입력해 주세요.';
// meeting-service AddAgendaRequest 검증 문구와 같다
const EMPTY_DECISION_MESSAGE = '결정할 사항을 1개 이상 입력해 주세요';

interface AddAgendaModalProps {
  /** 새 안건 제안(REQ-091)에서 열면 제안된 제목을 채워 둔다 */
  initialTitle?: string;
  onCancel: () => void;
  onAdd: (title: string, decisionPoints: string[]) => void;
}

/** REQ-090 회의 중 안건 추가. 안건 제목과 결정할 사항 1개 이상이 필수 (2026-10-23 결정) */
export default function AddAgendaModal({ initialTitle = '', onCancel, onAdd }: AddAgendaModalProps) {
  const titleId = useId();
  const [title, setTitle] = useState(initialTitle);
  const [decisionPoints, setDecisionPoints] = useState(['']);
  const [titleError, setTitleError] = useState<string>();
  const [decisionError, setDecisionError] = useState<string>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = cleanDecisionPoints(decisionPoints);
    setTitleError(title.trim() ? undefined : EMPTY_TITLE_MESSAGE);
    setDecisionError(cleaned.length > 0 ? undefined : EMPTY_DECISION_MESSAGE);
    if (!title.trim() || cleaned.length === 0) {
      return;
    }
    onAdd(title.trim(), cleaned);
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
          <DecisionPointFields
            values={decisionPoints}
            isRequired
            fieldClassName={styles.field}
            onChange={(values) => {
              setDecisionPoints(values);
              setDecisionError(undefined);
            }}
          />
          {decisionError && <p className={room.fieldError}>{decisionError}</p>}
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
