import { useState, type KeyboardEvent } from 'react';
import dotDecided from '../../../assets/dot-decided.svg';
import dotNotDiscussed from '../../../assets/dot-not-discussed.svg';
import dotUndecided from '../../../assets/dot-undecided.svg';
import Placeholder from '../../../components/Placeholder';
import type { DecisionPoint, DecisionStatus } from '../../../types/meetingRoom';
import room from './room.module.css';
import styles from './DecisionItem.module.css';

const EDIT_ICON_SIZE = 20;
const DOT_SIZE = 8;
// MSG-030
const EMPTY_SUMMARY_MESSAGE = '결정 내용을 입력해 주세요.';

const DOTS: Record<DecisionStatus, string> = {
  decided: dotDecided,
  undecided: dotUndecided,
  notDiscussed: dotNotDiscussed,
  // 디자인 없음: 결정 확인 필요는 미결과 같은 점
  decisionCheck: dotUndecided,
};

interface DecisionItemProps {
  decision: DecisionPoint;
  isSelected: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onSave: (summary: string) => void;
}

/**
 * REQ-124~126 결정할 사항. 누르면 오른쪽에 결정 근거를 보여 주고,
 * 회의록 작성자는 마우스를 올리면 나오는 연필 아이콘으로 결정 내용을 바로 고친다.
 */
export default function DecisionItem({ decision, isSelected, canEdit, onSelect, onSave }: DecisionItemProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const isEditing = draft !== null;

  const finishEditing = () => {
    if (draft === null) {
      return;
    }
    if (!draft.trim()) {
      setError(EMPTY_SUMMARY_MESSAGE);
      return;
    }
    onSave(draft.trim());
    setDraft(null);
    setError(undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      finishEditing();
    } else if (event.key === 'Escape') {
      setDraft(null);
      setError(undefined);
    }
  };

  return (
    <li className={[styles.item, isSelected ? styles.selected : ''].filter(Boolean).join(' ')}>
      <button type="button" className={styles.main} onClick={onSelect} aria-pressed={isSelected}>
        <span className={styles.titleRow}>
          <img src={DOTS[decision.status]} alt="" width={DOT_SIZE} height={DOT_SIZE} />
          <span className={styles.title}>{decision.title}</span>
        </span>
        {decision.summary && !isEditing && <span className={styles.summary}>{decision.summary}</span>}
      </button>
      {isEditing && (
        <div className={styles.editor}>
          <input
            className={styles.input}
            aria-label={`${decision.title} 결정 내용`}
            value={draft}
            autoFocus
            onChange={(event) => {
              setDraft(event.target.value);
              setError(undefined);
            }}
            onKeyDown={handleKeyDown}
            onBlur={finishEditing}
          />
          {error && <p className={room.fieldError}>{error}</p>}
        </div>
      )}
      {canEdit && decision.summary && !isEditing && (
        <button
          type="button"
          className={`${room.iconButton} ${styles.edit}`}
          aria-label={`${decision.title} 결정 내용 수정`}
          onClick={() => setDraft(decision.summary ?? '')}
        >
          <Placeholder size={EDIT_ICON_SIZE} />
        </button>
      )}
    </li>
  );
}
