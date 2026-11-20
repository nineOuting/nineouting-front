import { useEffect, useState } from 'react';
import { listCalendarMeetings } from '../../api/meeting';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import chevronRightIcon from '../../assets/icons/chevron-right.svg';
import Icon from '../../components/Icon';
import { monthGridDays, toIsoDate } from '../../utils/calendar';
import styles from './FolderCalendar.module.css';

const ICON_SIZE = 16;
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

interface FolderCalendarProps {
  folderId: number;
  /** REQ-202 점은 프로젝트 색 */
  color: string;
  /** 회의 목록을 이 날 회의로 걸러 보는 중 (2026-11-18) */
  selectedDay: string | null;
  /** 같은 날을 다시 누르면 null (해제) */
  onSelectDay: (day: string | null) => void;
}

/**
 * REQ-201 폴더 회의 목록 옆 월 달력. 이 프로젝트 회의가 있는 날에 점을 찍고,
 * 그 날을 누르면 회의 목록을 그날 회의로 걸러 보여 준다 (다시 누르면 해제)
 */
export default function FolderCalendar({ folderId, color, selectedDay, onSelectDay }: FolderCalendarProps) {
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [meetingDays, setMeetingDays] = useState<Set<string>>(new Set());
  const days = monthGridDays(month.year, month.month);
  const from = toIsoDate(days[0]);
  const to = toIsoDate(days[days.length - 1]);

  useEffect(() => {
    let isCurrent = true;
    listCalendarMeetings(from, to)
      .then((meetings) => {
        if (isCurrent) {
          setMeetingDays(new Set(meetings.filter((one) => one.folderId === folderId).map((one) => one.startAt.slice(0, 10))));
        }
      })
      .catch(() => isCurrent && setMeetingDays(new Set()));
    return () => {
      isCurrent = false;
    };
  }, [folderId, from, to]);

  const move = (step: number) =>
    setMonth(({ year, month: current }) => {
      const next = new Date(year, current + step, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  const todayIso = toIsoDate(today);

  return (
    <section className={styles.calendar} aria-label="회의 달력">
      <div className={styles.head}>
        <button type="button" className={styles.navButton} aria-label="이전 달" onClick={() => move(-1)}>
          <Icon src={chevronLeftIcon} size={ICON_SIZE} />
        </button>
        <span className={styles.month}>
          {month.year}년 {month.month + 1}월
        </span>
        <button type="button" className={styles.navButton} aria-label="다음 달" onClick={() => move(1)}>
          <Icon src={chevronRightIcon} size={ICON_SIZE} />
        </button>
      </div>
      <div className={styles.grid}>
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className={styles.weekday}>
            {label}
          </span>
        ))}
        {days.map((day) => {
          const iso = toIsoDate(day);
          const hasMeeting = meetingDays.has(iso);
          const classes = [
            styles.day,
            day.getMonth() !== month.month ? styles.outside : '',
            iso === todayIso ? styles.today : '',
            iso === selectedDay ? styles.selected : '',
          ].filter(Boolean);
          // 회의가 없는 날도 누를 수 있다. 누르면 회의 목록에 그날 회의가 없다고 알려 준다 (디자인 체크 2026-11-19)
          return (
            <button
              key={iso}
              type="button"
              className={classes.join(' ')}
              aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일 회의만 보기`}
              aria-pressed={iso === selectedDay}
              onClick={() => onSelectDay(iso === selectedDay ? null : iso)}
            >
              <span className={styles.dayNumber}>{day.getDate()}</span>
              {hasMeeting && <span className={styles.dot} style={{ background: color }} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
