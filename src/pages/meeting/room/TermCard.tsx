import termIcon from '../../../assets/icons/term-bulb.svg';
import Icon from '../../../components/Icon';
import styles from './TermCard.module.css';

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

/** 넵넵 AI 대화에 끼워 넣는 용어 한 장 */
export interface TermCardItem {
  id: string;
  /** 카드 제목 (용어집 이름이 없으면 전사 표기) */
  title: string;
  text: string;
  /** 처음 나온 전사 줄의 회의 경과 시간 (00:12:07). 그 줄을 아직 못 받았으면 없음 */
  spokenAt?: string;
  /** 이 화면을 연 뒤 받은 때 (ms). 입장할 때 한꺼번에 받은 용어는 언제 찾았는지 몰라 없음 */
  arrivedAt?: number;
  /** 넵넵 AI 탭에서 아직 확인하지 않은 용어 */
  isNew: boolean;
}

/** 받은 때를 "방금", "N분 전", "N시간 전"으로 */
function arrivedLabel(arrivedAt: number, now: number) {
  const minutes = Math.floor((now - arrivedAt) / MS_PER_MINUTE);
  if (minutes < 1) {
    return '방금';
  }
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes}분 전`;
  }
  return `${Math.floor(minutes / MINUTES_PER_HOUR)}시간 전`;
}

/**
 * REQ-191 디자인 TermCard (07 상태 모음 · 용어 먼저 알려주기, Live_23).
 * 처음 나온 용어를 넵넵 AI에 먼저 알려 준다. 확인 전에는 NEW 표시 + 연한 배경, 확인하면 일반 카드
 */
export default function TermCard({ card, now }: { card: TermCardItem; now: number }) {
  return (
    <div className={[styles.card, card.isNew ? styles.isNew : ''].filter(Boolean).join(' ')}>
      <span className={styles.head}>
        <Icon src={termIcon} size={14} />
        <span className={styles.label}>넵넵이가 알려드려요 · 용어</span>
        {card.arrivedAt !== undefined && <span className={styles.time}>{arrivedLabel(card.arrivedAt, now)}</span>}
      </span>
      <span className={styles.termRow}>
        <strong className={styles.term}>{card.title}</strong>
        {card.isNew && <span className={styles.newBadge}>NEW</span>}
      </span>
      <p className={styles.text}>{card.text}</p>
      {card.spokenAt && <span className={styles.from}>{card.spokenAt} 발언에서</span>}
    </div>
  );
}
