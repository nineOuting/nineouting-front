import Placeholder from '../../../components/Placeholder';
import type { AgendaStatus, DecisionStatus } from '../../../types/meetingRoom';
import styles from './StatusPill.module.css';

const ICON_SIZE = 16;

type PillTone = 'discussing' | 'decided' | 'notStarted' | 'undecided';

const LABELS: Record<PillTone, string> = {
  discussing: '논의 중',
  decided: '결정',
  notStarted: '논의 전',
  undecided: '미결',
};

const DECISION_TONES: Record<DecisionStatus, PillTone> = {
  decided: 'decided',
  undecided: 'undecided',
  notDiscussed: 'notStarted',
};

interface StatusPillProps {
  status: AgendaStatus;
  /** 실시간 요약의 현재 논의 표시는 목록보다 옅은 배경을 쓴다 */
  soft?: boolean;
}

/** REQ-086 안건 상태 표시 */
export default function StatusPill({ status, soft = false }: StatusPillProps) {
  return (
    <span className={[styles.pill, styles[status], soft ? styles.soft : ''].filter(Boolean).join(' ')}>
      <Placeholder size={ICON_SIZE} />
      {LABELS[status]}
    </span>
  );
}

/** REQ-124 결정할 사항 상태를 같은 모양으로 보여 준다 */
export function DecisionStatusPill({ status }: { status: DecisionStatus }) {
  return <StatusPill status={DECISION_TONES[status]} />;
}
