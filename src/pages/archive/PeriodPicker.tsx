import { useState } from 'react';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import chevronRightIcon from '../../assets/icons/chevron-right.svg';
import Icon from '../../components/Icon';
import { addDays, fromIsoDate, toIsoDate } from '../../utils/calendar';
import styles from './PeriodPicker.module.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const NAV_ICON_SIZE = 16;
// REQ-055 빠른 선택: 오늘부터 거슬러 1주, 1개월, 3개월
const QUICK_RANGES = [
  { label: '1주', days: 7, months: 0 },
  { label: '1개월', days: 0, months: 1 },
  { label: '3개월', days: 0, months: 3 },
];

export interface Period {
  from: string;
  to: string;
}

interface PeriodPickerProps {
  value: Period | null;
  /** [적용]: 고른 기간 (아무것도 안 골랐으면 null로 기간 필터를 푼다) */
  onApply: (period: Period | null) => void;
  /** [취소]: 바꾸지 않고 닫는다 */
  onCancel: () => void;
}

/** 일요일에 시작하는 6주 이하의 달력 (디자인 10 MiniCalendar) */
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

/** 2026-10-10 → 2026.10.10 (디자인 RangeField) */
function formatDot(isoDate: string) {
  return isoDate.replaceAll('-', '.');
}

/**
 * REQ-055 기간 필터 (디자인 10 상태 모음 "기간 필터", 폴더 화면과 같은 MiniCalendar).
 * 날짜를 두 번 눌러 시작일과 종료일을 고르고 [적용]한다. 한 번만 누르고 적용하면 그 하루 (SCRUM-366)
 */
export default function PeriodPicker({ value, onApply, onCancel }: PeriodPickerProps) {
  const [month, setMonth] = useState(() => (value ? fromIsoDate(value.from) : new Date()));
  const [from, setFrom] = useState<string | null>(value?.from ?? null);
  const [to, setTo] = useState<string | null>(value?.to ?? null);
  const [today] = useState(() => toIsoDate(new Date()));

  // 시작일만 골랐거나 기간을 다 골랐으면 새로 시작, 시작일만 있으면 종료일
  const pick = (isoDate: string) => {
    if (!from || to) {
      setFrom(isoDate);
      setTo(null);
      return;
    }
    const [start, end] = from <= isoDate ? [from, isoDate] : [isoDate, from];
    setFrom(start);
    setTo(end);
  };

  const end = to ?? from;
  const label = from && end ? `${formatDot(from)} ~ ${formatDot(end)}` : '기간을 골라 주세요';

  return (
    <div className={styles.picker}>
      <p className={[styles.rangeField, from ? '' : styles.placeholder].filter(Boolean).join(' ')}>{label}</p>
      <div className={styles.calendar}>
        <div className={styles.head}>
          <span className={styles.month}>
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </span>
          <button
            type="button"
            className={styles.navButton}
            aria-label="이전 달"
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
            const isEdge = Boolean(from && end && (isoDate === from || isoDate === end));
            const isInside = Boolean(from && end && isoDate > from && isoDate < end);
            return (
              <button
                key={isoDate}
                type="button"
                className={[
                  styles.day,
                  day.getMonth() !== month.getMonth() ? styles.outside : '',
                  isInside ? styles.inside : '',
                  isEdge ? styles.edge : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={formatDot(isoDate)}
                aria-pressed={isEdge || isInside}
                onClick={() => pick(isoDate)}
              >
                <span className={styles.dayNumber}>{day.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.quickRow}>
        {QUICK_RANGES.map((range) => (
          <button
            key={range.label}
            type="button"
            className={styles.quick}
            onClick={() => {
              const last = fromIsoDate(today);
              const first = range.months
                ? new Date(last.getFullYear(), last.getMonth() - range.months, last.getDate())
                : addDays(last, -range.days);
              setFrom(toIsoDate(first));
              setTo(today);
              setMonth(last);
            }}
          >
            {range.label}
          </button>
        ))}
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          className={styles.apply}
          onClick={() => onApply(from && end ? { from, to: end } : null)}
        >
          적용
        </button>
      </div>
    </div>
  );
}
