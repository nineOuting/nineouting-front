import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
}

/** 2026-10-20 → 2026.10.20(화) */
function display(isoDate: string) {
  const date = fromIsoDate(isoDate);
  return `${isoDate.replaceAll('-', '.')}(${WEEKDAY_NAMES[date.getDay()]})`;
}

/** 디자인 Input + 달력 Popover: 칸을 누르면 아래에 한 달 달력이 열리고, 날을 누르면 닫힌다 */
export default function DatePicker({ value, onChange, placeholder = '날짜 선택', label, error }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  // 창 안 스크롤 영역에 잘리지 않게 달력은 화면 기준(fixed)으로 칸 바로 아래에 띄운다
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();
  const buttonRef = useRef<HTMLButtonElement>(null);
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

  const shiftMonth = (delta: number) =>
    setMonth(({ year, month: current }) => {
      const next = new Date(year, current + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={[styles.box, isOpen ? styles.open : '', error ? styles.error : ''].filter(Boolean).join(' ')}
        aria-label={label ?? placeholder}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        ref={buttonRef}
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) {
            setPopoverStyle({ position: 'fixed', top: rect.bottom + 8, left: rect.left });
          }
          setIsOpen((open) => !open);
        }}
      >
        <span className={value ? styles.value : styles.placeholder}>{value ? display(value) : placeholder}</span>
        <Icon src={chevronDownIcon} size={ICON_SIZE} className={styles.icon} />
      </button>
      {isOpen && (
        <div className={styles.popover} style={popoverStyle} role="dialog" aria-label="날짜 고르기">
          <div className={styles.head}>
            <button type="button" className={styles.nav} aria-label="이전 달" onClick={() => shiftMonth(-1)}>
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
              return (
                <button
                  key={iso}
                  type="button"
                  className={[
                    styles.day,
                    day.getMonth() !== month.month ? styles.outside : '',
                    iso === today ? styles.today : '',
                    iso === value ? styles.selected : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={iso === value}
                  aria-label={display(iso)}
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
