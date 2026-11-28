import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import chevronDownIcon from '../assets/icons/chevron-down.svg';
import chevronLeftIcon from '../assets/icons/chevron-left.svg';
import chevronRightIcon from '../assets/icons/chevron-right.svg';
import { fromIsoDate, monthGridDays, toIsoDate } from '../utils/calendar';
import Icon from './Icon';
import styles from './DatePicker.module.css';

const ICON_SIZE = 20;
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

interface DatePickerProps {
  /** 2026-10-20, 비면 placeholder */
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  label?: string;
  error?: boolean;
  /** 이 날(2026-10-20)보다 앞선 날은 고를 수 없다. 회의 생성은 오늘 (SCRUM-410) */
  minDate?: string;
}

/** 2026-10-20 → 2026.10.20(화) */
function display(isoDate: string) {
  const date = fromIsoDate(isoDate);
  return `${isoDate.replaceAll('-', '.')}(${WEEKDAY_NAMES[date.getDay()]})`;
}

/** 디자인 Input + 달력 Popover: 칸을 누르면 아래에 한 달 달력이 열리고, 날을 누르면 닫힌다 */
export default function DatePicker({ value, onChange, placeholder = '날짜 선택', label, error, minDate }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() => {
    const base = value ? fromIsoDate(value) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const [today] = useState(() => toIsoDate(new Date()));

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  // 달력은 칸 아래에 붙어(absolute) 스크롤 영역과 함께 움직인다 (시작 시간 메뉴와 같은 방식).
  // 화면 기준(fixed)으로 띄우면 스크롤 이벤트를 받은 뒤에야 따라가서 튕겨 보이고, 낮은 창에서는 화면 밖으로 잘렸다.
  // 대신 열 때 달력 전체가 보이도록 스크롤 영역을 필요한 만큼만 내린다
  useLayoutEffect(() => {
    if (isOpen) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      popoverRef.current?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }, [isOpen]);

  const shiftMonth = (delta: number) =>
    setMonth(({ year, month: current }) => {
      const next = new Date(year, current + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  // 고를 수 있는 첫 달이면 이전 달로 가지 않는다
  const minMonth = minDate ? fromIsoDate(minDate) : null;
  const isFirstMonth = Boolean(minMonth && month.year === minMonth.getFullYear() && month.month <= minMonth.getMonth()) ||
    Boolean(minMonth && month.year < minMonth.getFullYear());

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={[styles.box, isOpen ? styles.open : '', error ? styles.error : ''].filter(Boolean).join(' ')}
        aria-label={label ?? placeholder}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={value ? styles.value : styles.placeholder}>{value ? display(value) : placeholder}</span>
        <Icon src={chevronDownIcon} size={ICON_SIZE} className={styles.icon} />
      </button>
      {isOpen && (
        <div ref={popoverRef} className={styles.popover} role="dialog" aria-label="날짜 고르기">
          <div className={styles.head}>
            <button type="button" className={styles.nav} aria-label="이전 달" disabled={isFirstMonth} onClick={() => shiftMonth(-1)}>
              <Icon src={chevronLeftIcon} size={ICON_SIZE} />
            </button>
            <span className={styles.month}>
              {month.year}년 {month.month + 1}월
            </span>
            <button type="button" className={styles.nav} aria-label="다음 달" onClick={() => shiftMonth(1)}>
              <Icon src={chevronRightIcon} size={ICON_SIZE} />
            </button>
          </div>
          <div className={styles.grid}>
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className={styles.weekday}>
                {weekday}
              </span>
            ))}
            {monthGridDays(month.year, month.month).map((day) => {
              const iso = toIsoDate(day);
              const isPast = Boolean(minDate && iso < minDate);
              return (
                <button
                  key={iso}
                  type="button"
                  className={[
                    styles.day,
                    // 다른 달 날짜도 고를 수 있으면 이번 달과 같은 색. 회색은 고를 수 없는 지난 날(.past)만 (SCRUM-410)
                    iso === today ? styles.today : '',
                    iso === value ? styles.selected : '',
                    isPast ? styles.past : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={iso === value}
                  aria-label={display(iso)}
                  disabled={isPast}
                  onClick={() => {
                    onChange(iso);
                    setIsOpen(false);
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
