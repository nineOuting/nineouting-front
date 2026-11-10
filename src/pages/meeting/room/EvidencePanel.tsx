import type { ReactNode } from 'react';
import closeIcon from '../../../assets/icons/close.svg';
import transcriptIcon from '../../../assets/icons/transcript.svg';
import Icon from '../../../components/Icon';
import type { DecisionPoint, TranscriptLine } from '../../../types/meetingRoom';
import room from './room.module.css';
import { DecisionStatusPill } from './StatusPill';
import styles from './SidePanel.module.css';

const ICON_SIZE = 24;
const EMPTY_ICON_SIZE = 48;

interface EvidencePanelProps {
  decision: DecisionPoint;
  lines: TranscriptLine[];
  onClose: () => void;
  /** REQ-172 AI 결과 안내 줄 */
  notice?: ReactNode;
}

/** REQ-125 결정 근거. 결정 내용과 근거 발언을 시각과 함께 보여 주고, 닫으면 실시간 전사로 돌아간다 */
export default function EvidencePanel({ decision, lines, onClose, notice }: EvidencePanelProps) {
  return (
    <>
      <div className={styles.headWithClose}>
        <div className={styles.head}>
          <div className={room.titleRow}>
            <Icon src={transcriptIcon} size={ICON_SIZE} className={room.titleIcon} />
            <h2 className={room.title}>{decision.title}</h2>
            <DecisionStatusPill status={decision.status} />
          </div>
          <p className={room.caption}>아래 발언들을 바탕으로 결정 사항을 찾았어요</p>
        </div>
        <button type="button" className={room.iconButton} aria-label="결정 근거 닫기" onClick={onClose}>
          <Icon src={closeIcon} size={ICON_SIZE} />
        </button>
      </div>
      <div className={styles.divider} />
      {notice}

      {lines.length === 0 ? (
        // MSG-028
        <div className={room.empty}>
          <Icon src={transcriptIcon} size={EMPTY_ICON_SIZE} className={room.emptyIcon} />
          <p className={room.emptyTitle}>결정 사항을 뒷받침할 발언이 부족합니다.</p>
          <p className={room.emptyCaption}>현재까지의 발언만으로는 결정 근거를 확인하기 어렵습니다.</p>
        </div>
      ) : (
        <div className={styles.evidence}>
          {decision.summary && <p className={styles.evidenceSummary}>{decision.summary}</p>}
          <ol className={styles.evidenceLines}>
            {lines.map((line) => (
              <li key={line.seq}>
                <span className={styles.time}>{line.time}</span>
                <p className={styles.text}>{line.text}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
