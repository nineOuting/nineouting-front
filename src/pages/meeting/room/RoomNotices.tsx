import { useEffect, useRef } from 'react';
import addIcon from '../../../assets/icons/add-sm.svg';
import errorIcon from '../../../assets/icons/error.svg';
import summaryIcon from '../../../assets/icons/summary.svg';
import Icon from '../../../components/Icon';
import { useCountdown } from '../../../hooks/useCountdown';
import type { SuggestedAgenda } from '../../../types/meetingRoom';
import styles from './RoomNotices.module.css';

// REQ-091 제안 창은 30초 뒤 저절로 닫힌다
const SUGGESTION_SECONDS = 30;
const ICON_SIZE = 16;

interface AgendaSuggestionProps {
  suggestion: SuggestedAgenda;
  onIgnore: () => void;
  onRegister: () => void;
  /** 30초가 지나 닫힐 때. 없으면 무시와 같다 (안건 보드에서 띄운 제안은 백엔드가 30초 뒤 무시로 보낸다) */
  onExpire?: () => void;
}

/** REQ-091, MSG-026 디자인 Version02 Live_05: 등록된 안건과 다른 주제가 이어지면 새 안건 등록을 제안한다 */
export function AgendaSuggestion({ suggestion, onIgnore, onRegister, onExpire = onIgnore }: AgendaSuggestionProps) {
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
      onExpire();
    }
  }, [remaining, onExpire]);

  return (
    <div role="alertdialog" aria-labelledby="agenda-suggestion-title" className={styles.notice}>
      <div className={styles.titleRow}>
        <p id="agenda-suggestion-title" className={styles.title}>
          <Icon src={summaryIcon} size={ICON_SIZE} className={styles.sparkle} />
          새로운 안건을 발견했어요
        </p>
        <span className={styles.remaining}>{remaining}초</span>
      </div>
      <p className={styles.caption}>등록된 안건과 다른 주제가 1분 넘게 이어지고 있어요.</p>
      <div className={styles.suggestion}>
        <p className={styles.suggestionTitle}>{suggestion.title}</p>
        {suggestion.description && <p className={styles.suggestionDescription}>{suggestion.description}</p>}
      </div>
      <div className={styles.progress} aria-hidden="true">
        <span style={{ width: `${(remaining / SUGGESTION_SECONDS) * 100}%` }} />
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.textButton} onClick={onIgnore}>
          무시
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onRegister}>
          <Icon src={addIcon} size={ICON_SIZE} />
          안건 등록
        </button>
      </div>
    </div>
  );
}

interface OffTopicNoticeProps {
  /** 지금 이어지는 주제 (알 수 있으면) */
  topic?: string;
  onConfirm: () => void;
  /** 넘기면 [새 안건으로 등록]으로 안건 추가 창을 연다 */
  onRegister?: () => void;
}

/** REQ-092, MSG-027 디자인 Version02 Live_06: 제안을 무시한 뒤에도 등록되지 않은 주제가 이어지면 알린다 */
export function OffTopicNotice({ topic, onConfirm, onRegister }: OffTopicNoticeProps) {
  return (
    <div role="alertdialog" aria-labelledby="off-topic-title" className={styles.notice}>
      <p id="off-topic-title" className={styles.title}>
        <Icon src={errorIcon} size={ICON_SIZE} className={styles.warningIcon} />
        등록되지 않은 주제로 논의가 이어지고 있어요
      </p>
      <p className={styles.caption}>기존 안건으로 돌아가거나 새 안건으로 등록해 주세요.</p>
      <div className={`${styles.suggestion} ${styles.warningBox}`}>
        <p className={styles.suggestionTitle}>지금 주제: {topic || '등록되지 않은 주제'}</p>
        <p className={styles.suggestionDescription}>새 안건 제안을 무시한 뒤 3분째 이어지고 있어요</p>
      </div>
      <div className={styles.actions}>
        {onRegister && (
          <button type="button" className={styles.textButton} onClick={onRegister}>
            <Icon src={addIcon} size={ICON_SIZE} />
            새 안건으로 등록
          </button>
        )}
        <button type="button" className={styles.secondaryButton} onClick={onConfirm}>
          확인
        </button>
      </div>
    </div>
  );
}
