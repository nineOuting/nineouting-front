import { useEffect, useRef, useState, type RefObject } from 'react';
import chevronLeftIcon from '../../../assets/icons/chevron-left.svg';
import chevronRightIcon from '../../../assets/icons/chevron-right.svg';
import Icon from '../../../components/Icon';
import { addDays, fromIsoDate, toIsoDate } from '../../../utils/calendar';
import styles from './DueDatePicker.module.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const NAV_ICON_SIZE = 20;
const DUE_PATTERN = /^(\d{1,2})\/(\d{1,2})\(.\)$/;

/** 2026-11-14 → 11/14(금) (디자인 07 "할 일 기한 고르기") */
function formatDue(isoDate: string) {
  const date = fromIsoDate(isoDate);
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAYS[date.getDay()]})`;
}

/** 11/14(금) → 오늘 이후의 그 날짜. "이번 주 목요일"처럼 AI가 말한 그대로면 null */
function parseDue(dueText: string | undefined, today: string) {
  const match = dueText?.match(DUE_PATTERN);
  if (!match) {
    return null;
  }
  const base = fromIsoDate(today);
  const month = Number(match[1]) - 1;
  const day = Number(match[2]);
  const thisYear = toIsoDate(new Date(base.getFullYear(), month, day));
  return thisYear >= today ? thisYear : toIsoDate(new Date(base.getFullYear() + 1, month, day));
}

/** 일요일에 시작하는 6주 이하의 달력 */
function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = addDays(last, 6 - last.getDay());
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

interface DueDatePickerProps {
  /** 지금 기한 글자. 11/14(금) 모양이면 그 날이 골라진 채로 열린다 */
  value?: string;
  anchorRef: RefObject<HTMLElement | null>;
  /** 고른 날을 11/14(금) 글자로 */
  onSelect: (dueText: string) => void;
  onClose: () => void;
}

/**
 * 디자인 07 상태 모음 "할 일 기한 고르기" (MiniCalendar, REQ-190, 11/25).
 * 날짜를 누르면 칩에 11/14(금)이 들어가고 닫힌다. 바깥·ESC로도 닫힌다.
 * 지난 날은 고를 수 없고, 다른 달 날짜도 고를 수 있으면 검정 (SCRUM-410)
 */
export default function DueDatePicker({ value, anchorRef, onSelect, onClose }: DueDatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [today] = useState(() => toIsoDate(new Date()));
  const [selected] = useState(() => parseDue(value, today));
  const [month, setMonth] = useState(() => {
    const base = fromIsoDate(selected ?? today);
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !anchorRef.current?.contains(target)) {
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
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose]);

  const todayDate = fromIsoDate(today);
  // 이번 달보다 앞으로는 가지 않는다 (지난 날은 고를 수 없다)
  const isFirstMonth =
    month.getFullYear() < todayDate.getFullYear() ||
    (month.getFullYear() === todayDate.getFullYear() && month.getMonth() <= todayDate.getMonth());

  return (
    <div ref={rootRef} className={styles.calendar} role="dialog" aria-label="기한 고르기">
      <div className={styles.head}>
        <span className={styles.month}>
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </span>
        <button
          type="button"
          className={styles.navButton}
          aria-label="이전 달"
          disabled={isFirstMonth}
          onClick={() => setMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}
        >
          <Icon src={chevronLeftIcon} size={NAV_ICON_SIZE} />
        </button>
        <button
          type="button"
          className={styles.navButton}
          aria-label="다음 달"
          onClick={() => setMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}
        >
          <Icon src={chevronRightIcon} size={NAV_ICON_SIZE} />
        </button>
      </div>
      <div className={styles.weekdays}>
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className={styles.weekday}>
            {weekday}
          </span>
        ))}
      </div>
      <div className={styles.grid}>
        {monthDays(month).map((day) => {
          const isoDate = toIsoDate(day);
          const isPast = isoDate < today;
          return (
            <button
              key={isoDate}
              type="button"
              className={[
                styles.day,
                isoDate === today ? styles.today : '',
                isoDate === selected ? styles.selected : '',
                isPast ? styles.past : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={formatDue(isoDate)}
              aria-pressed={isoDate === selected}
              disabled={isPast}
              onClick={() => onSelect(formatDue(isoDate))}
            >
              <span className={styles.dayNumber}>{day.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
