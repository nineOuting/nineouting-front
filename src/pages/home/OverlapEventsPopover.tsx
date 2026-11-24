import { useEffect, useRef } from 'react';
import type { CalendarMeeting } from '../../api/meeting';
import { toTime } from '../../utils/calendar';
import styles from './OverlapEventsPopover.module.css';

const WIDTH = 280;
const GAP_PX = 8;

interface OverlapEventsPopoverProps {
  /** 예: 11월 25일(수) 11:00 · 회의 3개 */
  title: string;
  meetings: CalendarMeeting[];
  /** 연 버튼 위치 (그 아래에 띄운다) */
  anchor: DOMRect;
  colorOf: (meeting: CalendarMeeting) => string;
  onPick: (meeting: CalendarMeeting, rect: DOMRect) => void;
  onClose: () => void;
}

/**
 * 디자인 시스템 CalendarOverlapSpec: 주간의 겹친 회의 [+N], 월간의 [+N개 더보기]를 누르면 그 회의들을 목록으로 보여 준다.
 * 줄을 누르면 회의 미리보기 카드를 연다. 바깥을 누르거나 Esc로 닫는다
 */
export default function OverlapEventsPopover({ title, meetings, anchor, colorOf, onPick, onClose }: OverlapEventsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  const left = Math.min(Math.max(GAP_PX, anchor.left), window.innerWidth - WIDTH - GAP_PX);
  const top = Math.min(anchor.bottom + GAP_PX / 2, window.innerHeight - GAP_PX - 60 * meetings.length - 40);

  return (
    <div ref={ref} role="dialog" aria-label={title} className={styles.popover} style={{ left, top: Math.max(GAP_PX, top) }}>
      <p className={styles.header}>{title}</p>
      {meetings.map((meeting) => (
        <button
          key={meeting.meetingId}
          type="button"
          className={styles.row}
          onClick={(event) => onPick(meeting, event.currentTarget.getBoundingClientRect())}
        >
          <span className={styles.color} style={{ background: colorOf(meeting) }} aria-hidden="true" />
          <span className={styles.texts}>
            <span className={styles.title}>{meeting.title}</span>
            <span className={styles.meta}>
              {toTime(meeting.startAt)} ~ {toTime(meeting.endAt)} · {meeting.folderName}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
