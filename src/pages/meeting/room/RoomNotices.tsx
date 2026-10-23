import { useEffect, useRef } from 'react';
import { useCountdown } from '../../../hooks/useCountdown';
import type { SuggestedAgenda } from '../../../types/meetingRoom';
import room from './room.module.css';
import styles from './RoomNotices.module.css';

// REQ-091 제안 창은 30초 뒤 저절로 닫힌다
const SUGGESTION_SECONDS = 30;

interface AgendaSuggestionProps {
  suggestion: SuggestedAgenda;
  onIgnore: () => void;
  onRegister: () => void;
}

/** REQ-091, MSG-026 등록된 안건과 무관한 주제가 이어지면 새 안건 등록을 제안한다 */
export function AgendaSuggestion({ suggestion, onIgnore, onRegister }: AgendaSuggestionProps) {
  const { start, remaining } = useCountdown();
  const wasCountingRef = useRef(false);

  useEffect(() => {
    start(SUGGESTION_SECONDS);
  }, [start]);

  // 타이머가 돌다가 0이 되면 무시한 것으로 보고 닫는다
  useEffect(() => {
    if (remaining > 0) {
      wasCountingRef.current = true;
      return;
    }
    if (wasCountingRef.current) {
      wasCountingRef.current = false;
      onIgnore();
    }
  }, [remaining, onIgnore]);

  return (
    <div role="alertdialog" aria-labelledby="agenda-suggestion-title" className={styles.notice}>
      <div className={styles.texts}>
        <div className={styles.titleRow}>
          <p id="agenda-suggestion-title" className={styles.title}>
            새로운 안건을 발견했습니다.
          </p>
          <span className={styles.remaining}>{remaining}초 후 사라집니다</span>
        </div>
        <p className={styles.caption}>회의에서 새로운 논의 주제가 나왔습니다.</p>
      </div>
      <div className={styles.suggestion}>
        <p className={styles.suggestionLabel}>새 안건</p>
        <p className={styles.suggestionTitle}>{suggestion.title}</p>
        <p className={styles.suggestionDescription}>{suggestion.description}</p>
      </div>
      <div className={room.pillRow}>
        <button type="button" className={`${room.pill} ${room.pillOutline}`} onClick={onIgnore}>
          무시
        </button>
        <button type="button" className={`${room.pill} ${room.pillPrimary}`} onClick={onRegister}>
          안건 등록
        </button>
      </div>
    </div>
  );
}

/** REQ-092, MSG-027 제안을 무시한 뒤에도 등록되지 않은 주제가 3분 넘게 이어지면 알린다 */
export function OffTopicNotice({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div role="alertdialog" aria-labelledby="off-topic-title" className={styles.notice}>
      <div className={styles.texts}>
        <p id="off-topic-title" className={styles.title}>
          등록되지 않은 주제로 논의가 이어지고 있습니다.
        </p>
        <p className={styles.caption}>기존 안건으로 돌아가거나 새 안건을 등록해 주세요.</p>
      </div>
      <div className={room.pillRow}>
        <button type="button" className={`${room.pill} ${room.pillPrimary}`} onClick={onConfirm}>
          확인
        </button>
      </div>
    </div>
  );
}
