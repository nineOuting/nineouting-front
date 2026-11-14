import { useState, type FormEvent } from 'react';
import Button from '../../../components/Button';
import Dialog from '../../../components/Dialog';
import TextField from '../../../components/TextField';
import useCloseGuard from '../../../components/useCloseGuard';

// meeting-service AddAgendaRequest 길이 제한과 같다
const TITLE_MAX_LENGTH = 100;
// MSG-029
const EMPTY_TITLE_MESSAGE = '안건 제목을 입력해 주세요.';
const PLACEHOLDER_DECISION = '결정할 사항';
const DECISION_MAX_LENGTH = 200;

interface AddAgendaModalProps {
  /** 새 안건 제안(REQ-091)에서 열면 제안된 제목을 채워 둔다 */
  initialTitle?: string;
  onCancel: () => void;
  onAdd: (title: string, decisionPoints: string[]) => void;
}

/** REQ-090 회의 중 안건 추가. 안건 제목과 결정할 사항 1개 이상이 필수 (2026-10-23 결정) */
export default function AddAgendaModal({ initialTitle = '', onCancel, onAdd }: AddAgendaModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [decision, setDecision] = useState('');
  const [titleError, setTitleError] = useState<string>();
  // REQ-179 입력한 내용이 있으면 닫기 전에 묻는다
  const { requestClose, confirmElement } = useCloseGuard(title.trim() !== initialTitle.trim() || decision.trim() !== '', onCancel);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTitleError(title.trim() ? undefined : EMPTY_TITLE_MESSAGE);
    if (!title.trim()) {
      return;
    }
    // 디자인은 결정할 내용이 선택이지만 meeting-service는 1개 이상 받는다. 비우면 고칠 자리만 넣는다
    onAdd(title.trim(), [decision.trim() || PLACEHOLDER_DECISION]);
  };

  return (
    <>
      <Dialog
        title="안건 추가"
        description="추가한 안건은 안건 목록 맨 아래에 들어가요."
        width="sm"
        onBack={requestClose}
        onClose={requestClose}
        onSubmit={handleSubmit}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={requestClose}>
              취소
            </Button>
            <Button type="submit" size="md">
              추가하기
            </Button>
          </>
        }
      >
        <TextField
          label="안건 제목"
          required
          placeholder="예: 온보딩 튜토리얼 영상 제작"
          maxLength={TITLE_MAX_LENGTH}
          value={title}
          error={titleError}
          autoFocus
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleError(undefined);
          }}
        />
        <TextField
          label="결정할 내용 (선택)"
          placeholder="예: 영상 길이와 담당자 정하기"
          maxLength={DECISION_MAX_LENGTH}
          value={decision}
          helper="결정할 내용을 적으면 AI가 논의 상태를 따라가요"
          onChange={(event) => setDecision(event.target.value)}
        />
      </Dialog>
      {confirmElement}
    </>
  );
}
