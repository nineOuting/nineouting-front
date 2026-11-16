import type { ReactNode } from 'react';
import checkIcon from '../../../assets/icons/check.svg';
import closeIcon from '../../../assets/icons/close.svg';
import errorIcon from '../../../assets/icons/error.svg';
import pauseIcon from '../../../assets/icons/pause.svg';
import transcriptIcon from '../../../assets/icons/transcript.svg';
import Icon from '../../../components/Icon';
import type { DecisionPoint, TranscriptLine } from '../../../types/meetingRoom';
import styles from './EvidencePanel.module.css';

const ICON_SIZE = 20;
const SMALL_ICON_SIZE = 14;

interface EvidencePanelProps {
  decision: DecisionPoint;
  lines: TranscriptLine[];
  onClose: () => void;
  /** REQ-172 AI 결과 안내 줄 */
  notice?: ReactNode;
}

/**
 * REQ-125 디자인 Version02 Live_07·08 결정 근거: 결정할 사항과 근거 발언(시각 + 말)을 파란 칸으로 보여 준다.
 * 근거가 없으면 "발언이 부족해요"를 안내한다. 닫으면 실시간 전사로 돌아간다
 */
export default function EvidencePanel({ decision, lines, onClose, notice }: EvidencePanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <Icon src={transcriptIcon} size={ICON_SIZE} />
          결정 근거
        </h2>
        <button type="button" className={styles.close} aria-label="결정 근거 닫기" onClick={onClose}>
          <Icon src={closeIcon} size={ICON_SIZE} />
        </button>
      </div>

      {lines.length > 0 && <p className={styles.count}>근거 발언 {lines.length}</p>}
      <p className={[styles.decision, styles[decision.status]].filter(Boolean).join(' ')}>
        <span className={styles.statusIcon} aria-hidden="true">
          {decision.status === 'decided' && <Icon src={checkIcon} size={SMALL_ICON_SIZE} />}
          {decision.status === 'undecided' && <Icon src={pauseIcon} size={SMALL_ICON_SIZE - 2} />}
        </span>
        {decision.title}
      </p>
      {decision.summary && lines.length > 0 && <p className={styles.summary}>{decision.summary}</p>}

      {lines.length === 0 ? (
        // MSG-028
        <div className={styles.empty}>
          <Icon src={errorIcon} size={ICON_SIZE} />
          <p className={styles.emptyTitle}>결정 사항을 뒷받침할 발언이 부족해요</p>
          <p className={styles.emptyText}>
            지금까지의 발언만으로는 결정 근거를 확인하기 어려워요. 논의가 더 이어지면 자동으로 채워져요
          </p>
        </div>
      ) : (
        <>
          <ol className={styles.lines}>
            {lines.map((line) => (
              <li key={line.seq} className={styles.line}>
                <span className={styles.time}>{line.time}</span>
                <p className={styles.text}>{line.text}</p>
              </li>
            ))}
          </ol>
          {notice}
        </>
      )}
    </div>
  );
}
