import type { DecisionStatusEdit } from '../../../api/meeting';
import type { DecisionPoint } from '../../../types/meetingRoom';
import styles from './DecisionStatusButtons.module.css';

interface DecisionStatusButtonsProps {
  decision: DecisionPoint;
  onChange: (status: DecisionStatusEdit) => void;
}

/**
 * 결정할 사항 상태 정하기 (임시 디자인). 사용자가 정하면 AI가 전사로 상태를 바꾸지 않고 "직접 정함"이 붙는다.
 * [AI 판정으로]를 누르면 다시 AI가 정한다 (ai-service agenda-status-contract.md 7.5)
 */
export default function DecisionStatusButtons({ decision, onChange }: DecisionStatusButtonsProps) {
  const isDecided = decision.statusEdited && decision.status === 'decided';
  const isUndecided = decision.statusEdited && decision.status === 'undecided';
  return (
    <div className={styles.row} role="group" aria-label={`${decision.title} 상태 정하기`}>
      <button
        type="button"
        className={[styles.button, isDecided ? styles.active : ''].filter(Boolean).join(' ')}
        aria-pressed={isDecided}
        onClick={(event) => {
          event.stopPropagation();
          onChange('DECIDED');
        }}
      >
        결정
      </button>
      <button
        type="button"
        className={[styles.button, isUndecided ? styles.active : ''].filter(Boolean).join(' ')}
        aria-pressed={isUndecided}
        onClick={(event) => {
          event.stopPropagation();
          onChange('UNDECIDED');
        }}
      >
        미결
      </button>
      {decision.statusEdited ? (
        <>
          <span className={styles.badge}>직접 정함</span>
          <button
            type="button"
            className={styles.auto}
            onClick={(event) => {
              event.stopPropagation();
              onChange('AUTO');
            }}
          >
            AI 판정으로
          </button>
        </>
      ) : (
        <span className={styles.hint}>AI가 판정 중</span>
      )}
    </div>
  );
}
