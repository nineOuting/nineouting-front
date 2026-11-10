import { useState, type FormEvent } from 'react';
import Button from '../../../components/Button';
import Dialog from '../../../components/Dialog';
import TextField from '../../../components/TextField';
import { cleanDecisionPoints } from '../../../constants/meeting';
import DecisionPointFields from '../DecisionPointFields';
import room from './room.module.css';
import styles from './AddAgendaModal.module.css';
import useCloseGuard from '../../../components/useCloseGuard';

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
  const [title, setTitle] = useState(initialTitle);
  const [decisionPoints, setDecisionPoints] = useState(['']);
  const [titleError, setTitleError] = useState<string>();
  const [decisionError, setDecisionError] = useState<string>();
  // REQ-179 입력한 내용이 있으면 닫기 전에 묻는다
  const { requestClose, confirmElement } = useCloseGuard(title.trim() !== initialTitle.trim() || decisionPoints.some((point) => point.trim() !== ''), onCancel);

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
    <>
      <Dialog
        title="새 안건 추가"
        description="회의 중에 논의할 안건을 더해요"
        width="md"
        onClose={requestClose}
        onSubmit={handleSubmit}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={requestClose}>
              취소
            </Button>
            <Button type="submit" size="md">
              안건 추가
            </Button>
          </>
        }
      >
        <TextField
          label="안건 제목"
          required
          placeholder="예: 핵심 기능 우선순위 결정"
          maxLength={TITLE_MAX_LENGTH}
          value={title}
          error={titleError}
          autoFocus
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError(undefined);
          }}
        />
        <div className={styles.decisionGroup}>
          <DecisionPointFields
            values={decisionPoints}
            isRequired
            onChange={(values) => {
              setDecisionPoints(values);
              setDecisionError(undefined);
            }}
          />
          {decisionError && <p className={room.fieldError}>{decisionError}</p>}
          <p className={styles.hint}>예: 1차 개발에 포함할 기능 3개를 확정한다.</p>
        </div>
      </Dialog>
      {confirmElement}
    </>
  );
}
