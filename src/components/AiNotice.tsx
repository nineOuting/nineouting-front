import { useState } from 'react';
import { sendAiFeedback, type AiFeedbackRating, type AiFeedbackTarget } from '../api/meeting';
import summaryIcon from '../assets/icons/summary.svg';
import Icon from './Icon';
import styles from './AiNotice.module.css';

const ICON_SIZE = 16;

interface AiNoticeProps {
  meetingId: number;
  target: AiFeedbackTarget;
}

/**
 * REQ-172 AI가 정리한 내용 위의 안내 줄 (MSG-070)과 [정확해요], [고칠 부분 있어요].
 * 누른 피드백은 AI 품질을 고치는 데 쓴다 (meeting-service에 남는다)
 */
export default function AiNotice({ meetingId, target }: AiNoticeProps) {
  const [rating, setRating] = useState<AiFeedbackRating | null>(null);
  const [isSending, setIsSending] = useState(false);

  const send = async (next: AiFeedbackRating) => {
    setIsSending(true);
    try {
      await sendAiFeedback(meetingId, target, next);
      setRating(next);
    } catch {
      // 피드백은 회의 진행에 꼭 필요하지 않아 실패해도 조용히 넘어간다
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.notice}>
      <Icon src={summaryIcon} size={ICON_SIZE} className={styles.icon} />
      <p className={styles.text}>
        {rating ? '의견 고마워요. AI가 더 잘 정리하는 데 쓸게요.' : 'AI가 정리한 내용이에요. 틀린 부분이 있을 수 있어요.'}
      </p>
      <span className={styles.actions}>
        <button
          type="button"
          className={rating === 'ACCURATE' ? `${styles.action} ${styles.selected}` : styles.action}
          aria-pressed={rating === 'ACCURATE'}
          disabled={isSending}
          onClick={() => void send('ACCURATE')}
        >
          정확해요
        </button>
        <button
          type="button"
          className={rating === 'NEEDS_FIX' ? `${styles.action} ${styles.selected}` : styles.action}
          aria-pressed={rating === 'NEEDS_FIX'}
          disabled={isSending}
          onClick={() => void send('NEEDS_FIX')}
        >
          고칠 부분 있어요
        </button>
      </span>
    </div>
  );
}
