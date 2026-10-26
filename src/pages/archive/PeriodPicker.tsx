import { useState } from 'react';
import dividerPeriod from '../../assets/divider-period.svg';
import Placeholder from '../../components/Placeholder';
import { addDays, formatPeriodDate, fromIsoDate, toIsoDate } from '../../utils/calendar';
import styles from './PeriodPicker.module.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const NAV_ICON_SIZE = 16;
const DIVIDER_WIDTH = 227;

export interface Period {
  from: string;
  to: string;
}

interface PeriodPickerProps {
  value: Period | null;
  onChange: (period: Period) => void;
}

/** 일요일에 시작하는 달력 (디자인 23:2169) */
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

/**
 * REQ-055 기간 필터 (디자인 23:2157). 기본은 하루를 고르고, [시작일 / 종료일]을 켜면 두 번 눌러 기간을 고른다.
 * 디자인의 "날짜 형식"은 무엇을 바꾸는지 정해지지 않아 뺐다 (docs/backlog.md)
 */
export default function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const [month, setMonth] = useState(() => (value ? fromIsoDate(value.from) : new Date()));
  const [isRange, setIsRange] = useState(Boolean(value && value.from !== value.to));
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [today] = useState(() => toIsoDate(new Date()));

  const pick = (isoDate: string) => {
    if (!isRange) {
      onChange({ from: isoDate, to: isoDate });
      return;
    }
    if (!rangeStart) {
      setRangeStart(isoDate);
      return;
    }
    const [from, to] = rangeStart <= isoDate ? [rangeStart, isoDate] : [isoDate, rangeStart];
    setRangeStart(null);
    onChange({ from, to });
  };

  const shown = rangeStart ? { from: rangeStart, to: rangeStart } : value;
  const label = !shown
    ? '날짜를 골라 주세요'
    : shown.from === shown.to
      ? formatPeriodDate(shown.from)
      : `${formatPeriodDate(shown.from)} - ${formatPeriodDate(shown.to)}`;

  return (
    <div className={styles.picker}>
      <p className={styles.selected}>{label}</p>
      <div className={styles.monthRow}>
        <span className={styles.month}>
          {month.getFullYear()} {month.getMonth() + 1}월
        </span>
        <span className={styles.nav}>
          <button
            type="button"
            className={styles.today}
            onClick={() => {
              setMonth(new Date());
              pick(today);
            }}
          >
            오늘
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="이전 달"
            onClick={() => setMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}
          >
            <Placeholder size={NAV_ICON_SIZE} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="다음 달"
            onClick={() => setMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}
          >
            <Placeholder size={NAV_ICON_SIZE} />
          </button>
        </span>
      </div>
      <div className={styles.grid}>
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className={styles.weekday}>
            {weekday}
          </span>
        ))}
        {monthDays(month).map((day) => {
          const isoDate = toIsoDate(day);
          const isEdge = shown && (isoDate === shown.from || isoDate === shown.to);
          const isInside = shown && isoDate > shown.from && isoDate < shown.to;
          return (
            <button
              key={isoDate}
              type="button"
              className={[
                styles.day,
                day.getMonth() !== month.getMonth() ? styles.otherMonth : '',
                isInside ? styles.inside : '',
                isEdge ? styles.edge : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={formatPeriodDate(isoDate)}
              aria-pressed={Boolean(isEdge || isInside)}
              onClick={() => pick(isoDate)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
      <img src={dividerPeriod} alt="" width={DIVIDER_WIDTH} height={1} className={styles.divider} />
      <label className={styles.option}>
        시작일 / 종료일
        <input
          type="checkbox"
          role="switch"
          className={styles.switchInput}
          checked={isRange}
          onChange={(event) => {
            setIsRange(event.target.checked);
            setRangeStart(null);
          }}
        />
        <span className={styles.switch} aria-hidden="true" />
      </label>
    </div>
  );
}
