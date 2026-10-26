import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCalendarMeetings, type CalendarMeeting } from '../../api/meeting';
import dotCalendarEvent from '../../assets/dot-calendar-event.svg';
import DropdownMenu from '../../components/DropdownMenu';
import Placeholder from '../../components/Placeholder';
import type { WorkspaceSummary } from '../../types/workspace';
import { addDays, minutesOfDay, monthGridDays, toIsoDate, toTime, weekDays } from '../../utils/calendar';
import { meetingPath } from '../../utils/meetingFormat';
import styles from './HomeCalendar.module.css';

type View = 'week' | 'month';

const DAY_NAMES = ['MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT', 'SUN'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
// 디자인 칸 높이 69px = 1시간. 처음에는 09:00부터 보인다
const HOUR_HEIGHT = 69;
const FIRST_VISIBLE_HOUR = 9;
// 30분보다 짧은 회의도 제목은 보이게 한다
const MIN_EVENT_HEIGHT = 23;
const ICON_SIZE = 26;
const FILTER_ICON_SIZE = 20;
const FOLDER_ICON_SIZE = 16;
const DOT_SIZE = 5;
const MONTH_EVENT_LIMIT = 2;
const ALL_WORKSPACES = 'all';

interface HomeCalendarProps {
  workspaces: WorkspaceSummary[];
}

function EventDot() {
  return <img src={dotCalendarEvent} alt="" width={DOT_SIZE} height={DOT_SIZE} className={styles.dot} />;
}

/** REQ-018~020 홈 캘린더 (주간·월간). 끝난 회의는 회색으로 구분한다 */
export default function HomeCalendar({ workspaces }: HomeCalendarProps) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('week');
  const [cursor, setCursor] = useState(() => new Date());
  const [today] = useState(() => toIsoDate(new Date()));
  const [workspaceFilter, setWorkspaceFilter] = useState(ALL_WORKSPACES);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [error, setError] = useState(false);
  const filterRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = useMemo(
    () => (view === 'week' ? weekDays(cursor) : monthGridDays(cursor.getFullYear(), cursor.getMonth())),
    [view, cursor],
  );
  const from = toIsoDate(days[0]);
  const to = toIsoDate(days[days.length - 1]);

  useEffect(() => {
    let isCurrent = true;
    listCalendarMeetings(from, to)
      .then((items) => {
        if (isCurrent) {
          setMeetings(items);
          setError(false);
        }
      })
      .catch(() => isCurrent && setError(true));
    return () => {
      isCurrent = false;
    };
  }, [from, to]);

  useLayoutEffect(() => {
    if (view === 'week' && scrollRef.current) {
      scrollRef.current.scrollTop = FIRST_VISIBLE_HOUR * HOUR_HEIGHT;
    }
  }, [view]);

  const shown = meetings.filter(
    (meeting) => workspaceFilter === ALL_WORKSPACES || String(meeting.workspaceId) === workspaceFilter,
  );
  const byDay = (day: Date) => shown.filter((meeting) => meeting.startAt.startsWith(toIsoDate(day)));
  const filterLabel =
    workspaces.find(({ workspaceId }) => String(workspaceId) === workspaceFilter)?.name ?? '전체 프로젝트';

  const move = (direction: 1 | -1) =>
    setCursor((date) =>
      view === 'week' ? addDays(date, direction * 7) : new Date(date.getFullYear(), date.getMonth() + direction, 1),
    );
  const eventClass = (meeting: CalendarMeeting) =>
    [styles.event, meeting.status === 'FINISHED' ? styles.past : ''].filter(Boolean).join(' ');
  const eventLabel = (meeting: CalendarMeeting) =>
    `${meeting.title}, ${toTime(meeting.startAt)} - ${toTime(meeting.endAt)}, ${meeting.folderName}${
      meeting.status === 'FINISHED' ? ', 끝난 회의' : ''
    }`;

  return (
    <section className={styles.calendar} aria-label="캘린더">
      <div className={styles.toolbar}>
        <div className={styles.month}>
          <button type="button" className={styles.pill} onClick={() => setCursor(new Date())}>
            오늘
          </button>
          <button type="button" className={styles.iconButton} aria-label={view === 'week' ? '이전 주' : '이전 달'} onClick={() => move(-1)}>
            <Placeholder size={ICON_SIZE} />
          </button>
          <span className={styles.monthLabel}>
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </span>
          <button type="button" className={styles.iconButton} aria-label={view === 'week' ? '다음 주' : '다음 달'} onClick={() => move(1)}>
            <Placeholder size={ICON_SIZE} />
          </button>
        </div>
        <div className={styles.toggle} role="group" aria-label="보기">
          {(['week', 'month'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={[styles.toggleOption, view === option ? styles.toggleActive : ''].filter(Boolean).join(' ')}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {option === 'week' ? '주간' : '월간'}
            </button>
          ))}
        </div>
        <div className={styles.filter}>
          <button
            ref={filterRef}
            type="button"
            className={`${styles.pill} ${styles.filterButton}`}
            aria-haspopup="listbox"
            aria-expanded={isFilterOpen}
            onClick={() => setIsFilterOpen((open) => !open)}
          >
            {filterLabel}
            <Placeholder size={FILTER_ICON_SIZE} />
          </button>
          {isFilterOpen && (
            <DropdownMenu
              label="프로젝트로 거르기"
              emptyText="워크스페이스가 없어요"
              anchorRef={filterRef}
              className={styles.filterMenu}
              items={[
                { id: ALL_WORKSPACES, label: '전체 프로젝트', isSelected: workspaceFilter === ALL_WORKSPACES },
                ...workspaces.map(({ workspaceId, name }) => ({
                  id: String(workspaceId),
                  label: name,
                  isSelected: workspaceFilter === String(workspaceId),
                })),
              ]}
              onSelect={(id) => {
                setWorkspaceFilter(id);
                setIsFilterOpen(false);
              }}
              onClose={() => setIsFilterOpen(false)}
            />
          )}
        </div>
      </div>

      {error && <p className={styles.error}>회의 일정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}

      {view === 'week' ? (
        <div className={styles.week}>
          <div className={styles.weekHead}>
            <span className={styles.timeSpacer} />
            {days.map((day, index) => (
              <span key={index} className={[styles.dayName, toIsoDate(day) === today ? styles.today : ''].filter(Boolean).join(' ')}>
                {DAY_NAMES[index]} <span className={styles.dayNumber}>{day.getDate()}</span>
              </span>
            ))}
          </div>
          <div ref={scrollRef} className={styles.weekBody}>
            <div className={styles.times} aria-hidden="true">
              {HOURS.map((hour) => (
                <span key={hour} className={styles.time}>
                  {String(hour).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            {days.map((day) => (
              <div key={toIsoDate(day)} className={styles.dayColumn}>
                {HOURS.map((hour) => (
                  <span key={hour} className={styles.hourCell} />
                ))}
                {byDay(day).map((meeting) => {
                  const start = minutesOfDay(meeting.startAt);
                  const end = meeting.endAt.startsWith(toIsoDate(day)) ? minutesOfDay(meeting.endAt) : 24 * 60;
                  return (
                    <button
                      key={meeting.meetingId}
                      type="button"
                      className={`${eventClass(meeting)} ${styles.weekEvent}`}
                      style={{
                        top: (start / 60) * HOUR_HEIGHT,
                        height: Math.max(((end - start) / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT),
                      }}
                      aria-label={eventLabel(meeting)}
                      onClick={() => navigate(meetingPath(meeting))}
                    >
                      <span className={styles.eventTitle}>
                        <EventDot />
                        <span className={styles.ellipsis}>{meeting.title}</span>
                      </span>
                      <span className={styles.eventMeta}>
                        {toTime(meeting.startAt)} - {toTime(meeting.endAt)}
                      </span>
                      <span className={styles.eventFolder}>
                        <Placeholder size={FOLDER_ICON_SIZE} />
                        <span className={styles.ellipsis}>{meeting.folderName}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.monthGrid}>
          {DAY_NAMES.map((name) => (
            <span key={name} className={styles.dayName}>
              {name}
            </span>
          ))}
          {days.map((day) => {
            const items = byDay(day);
            const isOtherMonth = day.getMonth() !== cursor.getMonth();
            return (
              <div key={toIsoDate(day)} className={[styles.monthCell, isOtherMonth ? styles.otherMonth : ''].filter(Boolean).join(' ')}>
                <span className={[styles.monthDate, toIsoDate(day) === today ? styles.today : ''].filter(Boolean).join(' ')}>
                  {day.getDate()}
                </span>
                {items.slice(0, MONTH_EVENT_LIMIT).map((meeting) => (
                  <button
                    key={meeting.meetingId}
                    type="button"
                    className={`${eventClass(meeting)} ${styles.monthEvent}`}
                    aria-label={eventLabel(meeting)}
                    onClick={() => navigate(meetingPath(meeting))}
                  >
                    <span className={styles.eventTitle}>
                      <EventDot />
                      <span className={styles.ellipsis}>{meeting.title}</span>
                    </span>
                  </button>
                ))}
                {items.length > MONTH_EVENT_LIMIT && (
                  <button
                    type="button"
                    className={styles.more}
                    onClick={() => {
                      setCursor(day);
                      setView('week');
                    }}
                  >
                    +{items.length - MONTH_EVENT_LIMIT}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
