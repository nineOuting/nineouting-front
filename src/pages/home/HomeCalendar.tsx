import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listCalendarMeetings, type CalendarMeeting } from '../../api/meeting';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import chevronRightIcon from '../../assets/icons/chevron-right.svg';
import chevronUpIcon from '../../assets/icons/chevron-up-sm.svg';
import { addDays, minutesOfDay, monthGridDays, toIsoDate, toTime, weekDays } from '../../utils/calendar';
import { meetingPath } from '../../utils/meetingFormat';
import MeetingPreviewCard from './MeetingPreviewCard';
import OverlapEventsPopover from './OverlapEventsPopover';
import ProjectFilter, { type FolderOption } from './ProjectFilter';
import { folderColor, folderSubtleColor } from '../../utils/folderColor';
import styles from './HomeCalendar.module.css';

type View = 'week' | 'month';

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
// 디자인 칸 높이 56px = 1시간. 처음에는 09:00부터 보인다
const HOUR_HEIGHT = 56;
const FIRST_VISIBLE_HOUR = 9;
// 칸 경계선과 겹치지 않게 위아래로 띄운다
const EVENT_GAP = 2;
// 30분보다 짧은 회의도 제목은 보이게 한다
const MIN_EVENT_HEIGHT = 24;
// 제목 줄과 시간 줄이 다 보이는 칸 높이 (위아래 여백 4+4, 제목 16, 간격 4, 시간 16). 이보다 낮으면 [+N]을 제목 줄 오른쪽에 둔다
const TWO_LINE_EVENT_HEIGHT = 44;
const ARROW_ICON_SIZE = 20;
const FILTER_ICON_SIZE = 16;
const MONTH_EVENT_LIMIT = 2;
const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/** 시간이 겹치는 회의끼리 묶는다 (A와 B, B와 C가 겹치면 셋이 한 묶음). 시작 순 */
function overlapGroups(items: CalendarMeeting[]) {
  const sorted = [...items].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const groups: { meetings: CalendarMeeting[]; end: string }[] = [];
  for (const meeting of sorted) {
    const last = groups[groups.length - 1];
    if (last && meeting.startAt < last.end) {
      last.meetings.push(meeting);
      if (meeting.endAt > last.end) {
        last.end = meeting.endAt;
      }
    } else {
      groups.push({ meetings: [meeting], end: meeting.endAt });
    }
  }
  return groups.map(({ meetings }) => meetings);
}

/** 11월 25일(수) */
function dayLabel(day: Date) {
  return `${day.getMonth() + 1}월 ${day.getDate()}일(${WEEKDAY_NAMES[day.getDay()]})`;
}

interface HomeCalendarProps {
  /** 내 워크스페이스들의 프로젝트 폴더 (홈이 불러와 작성 중인 회의록 카드와 같이 쓴다) */
  folders: FolderOption[];
}

/** 주간: 2026년 10월 19일 ~ 25일 (달이 바뀌면 ~ 11월 1일), 월간: 2026년 10월 */
function rangeLabel(view: View, cursor: Date, days: Date[]) {
  if (view === 'month') {
    return `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`;
  }
  const [first, last] = [days[0], days[days.length - 1]];
  const end = first.getMonth() === last.getMonth() ? `${last.getDate()}일` : `${last.getMonth() + 1}월 ${last.getDate()}일`;
  return `${first.getFullYear()}년 ${first.getMonth() + 1}월 ${first.getDate()}일 ~ ${end}`;
}

/** REQ-018~020 홈 캘린더 (주간·월간). 끝난 회의는 회색으로 구분한다 */
export default function HomeCalendar({ folders }: HomeCalendarProps) {
  const navigate = useNavigate();
  // REQ-180 보기 방식(주간/월간)은 주소에 둬서 회의를 보고 뒤로 와도 그대로다
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get('view') === 'month' ? 'month' : 'week';
  const setView = (next: View) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'month') {
      params.set('view', 'month');
    } else {
      params.delete('view');
    }
    setSearchParams(params, { replace: true });
  };
  // REQ-019 누른 회의의 미리보기 카드
  const [preview, setPreview] = useState<{ meeting: CalendarMeeting; anchor: DOMRect } | null>(null);
  // 디자인 시스템 CalendarOverlapSpec: 겹친 회의, 그날 회의 전체 목록
  const [overlap, setOverlap] = useState<{ title: string; meetings: CalendarMeeting[]; anchor: DOMRect } | null>(null);
  const [cursor, setCursor] = useState(() => new Date());
  const [today] = useState(() => toIsoDate(new Date()));
  // 프로젝트 = 프로젝트 폴더. 워크스페이스가 아니라 폴더 단위로 거른다
  // REQ-147 체크박스로 여러 폴더를 고른다. null이면 전체
  const [folderFilter, setFolderFilter] = useState<number[] | null>(null);
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
    (meeting) => folderFilter === null || folderFilter.includes(meeting.folderId),
  );
  const byDay = (day: Date) =>
    shown.filter((meeting) => meeting.startAt.startsWith(toIsoDate(day))).sort((a, b) => a.startAt.localeCompare(b.startAt));
  // 일부만 고르면 버튼에 고른 개수 (하나면 그 이름)
  const filterLabel =
    folderFilter === null
      ? '전체 프로젝트'
      : folderFilter.length === 1
        ? (folders.find(({ folderId }) => folderId === folderFilter[0])?.label ?? '프로젝트 1개')
        : `프로젝트 ${folderFilter.length}개`;

  const closeOverlap = useCallback(() => setOverlap(null), []);
  const move = (direction: 1 | -1) =>
    setCursor((date) =>
      view === 'week' ? addDays(date, direction * 7) : new Date(date.getFullYear(), date.getMonth() + direction, 1),
    );
  // 화면을 연 시각 기준 (렌더마다 시계를 읽지 않는다)
  const [openedAt] = useState(() => Date.now());
  // 끝난 회의와, 끝날 시각이 지나도록 열리지 않은 회의는 지난 회의로 회색 (디자인 체크 2026-11-19)
  const isPast = (meeting: CalendarMeeting) =>
    meeting.status === 'FINISHED' || new Date(meeting.endAt).getTime() < openedAt;
  const eventClass = (meeting: CalendarMeeting) => [styles.event, isPast(meeting) ? styles.past : ''].filter(Boolean).join(' ');
  // REQ-202 일정은 프로젝트 색: 왼쪽 줄은 진한 색, 바탕은 옅은 색. 끝난 회의는 바탕만 회색
  const eventStyle = (meeting: CalendarMeeting) => {
    const color = folders.find(({ folderId }) => folderId === meeting.folderId)?.color;
    return {
      borderLeftColor: folderColor(color),
      ...(isPast(meeting) ? {} : { background: folderSubtleColor(color) }),
    };
  };
  const eventLabel = (meeting: CalendarMeeting) =>
    `${meeting.title}, ${toTime(meeting.startAt)} - ${toTime(meeting.endAt)}, ${meeting.folderName}${
      isPast(meeting) ? ', 지난 회의' : ''
    }`;

  return (
    <section className={styles.calendar} aria-label="캘린더">
      <div className={styles.toolbar}>
        <div className={styles.dateNav}>
          <button type="button" className={styles.today} onClick={() => setCursor(new Date())}>
            오늘
          </button>
          <button type="button" className={styles.iconButton} aria-label={view === 'week' ? '이전 주' : '이전 달'} onClick={() => move(-1)}>
            <img src={chevronLeftIcon} alt="" width={ARROW_ICON_SIZE} height={ARROW_ICON_SIZE} />
          </button>
          <span className={styles.rangeLabel}>{rangeLabel(view, cursor, days)}</span>
          <button type="button" className={styles.iconButton} aria-label={view === 'week' ? '다음 주' : '다음 달'} onClick={() => move(1)}>
            <img src={chevronRightIcon} alt="" width={ARROW_ICON_SIZE} height={ARROW_ICON_SIZE} />
          </button>
        </div>
        <div className={styles.viewOptions}>
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
            className={styles.filterButton}
            aria-haspopup="dialog"
            aria-expanded={isFilterOpen}
            onClick={() => setIsFilterOpen((open) => !open)}
          >
            {filterLabel}
            <img
              src={chevronUpIcon}
              alt=""
              width={FILTER_ICON_SIZE}
              height={FILTER_ICON_SIZE}
              className={isFilterOpen ? undefined : styles.flipped}
            />
          </button>
          {isFilterOpen && (
            <ProjectFilter
              folders={folders}
              selected={folderFilter}
              anchorRef={filterRef}
              onApply={(selected) => {
                setFolderFilter(selected);
                setIsFilterOpen(false);
              }}
              onClose={() => setIsFilterOpen(false)}
            />
          )}
        </div>
        </div>
      </div>

      {error && <p className={styles.error}>회의 일정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}

      {view === 'week' ? (
        <div className={styles.week}>
          <div className={styles.weekHead}>
            <span className={styles.timeSpacer} />
            {days.map((day, index) => (
              <span key={index} className={[styles.dayHeader, toIsoDate(day) === today ? styles.isToday : ''].filter(Boolean).join(' ')}>
                <span className={styles.dayName}>{DAY_NAMES[index]}</span>
                <span className={styles.dateCircle}>{day.getDate()}</span>
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
              <div
                key={toIsoDate(day)}
                className={[styles.dayColumn, toIsoDate(day) === today ? styles.todayColumn : ''].filter(Boolean).join(' ')}
              >
                {HOURS.map((hour) => (
                  <span key={hour} className={styles.hourCell} />
                ))}
                {overlapGroups(byDay(day)).map((group) => {
                  // 겹친 회의는 앞 회의 하나만 그리고 [+N]으로 나머지를 알린다 (누르면 목록)
                  const meeting = group[0];
                  const start = minutesOfDay(meeting.startAt);
                  const end = meeting.endAt.startsWith(toIsoDate(day)) ? minutesOfDay(meeting.endAt) : 24 * 60;
                  const top = (start / 60) * HOUR_HEIGHT + EVENT_GAP;
                  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT - EVENT_GAP * 2, MIN_EVENT_HEIGHT);
                  const isShort = height < TWO_LINE_EVENT_HEIGHT;
                  const event = (
                    <button
                      key={meeting.meetingId}
                      type="button"
                      className={`${eventClass(meeting)} ${styles.weekEvent} ${group.length > 1 ? (isShort ? styles.hasMoreShort : styles.hasMore) : ''}`}
                      style={{
                        ...eventStyle(meeting),
                        top,
                        height,
                      }}
                      aria-label={eventLabel(meeting)}
                      onClick={(event) => setPreview({ meeting, anchor: event.currentTarget.getBoundingClientRect() })}
                    >
                      <span className={styles.eventTitle}>{meeting.title}</span>
                      <span className={styles.eventMeta}>
                        {toTime(meeting.startAt)} ~ {toTime(meeting.endAt)}
                      </span>
                    </button>
                  );
                  if (group.length === 1) {
                    return event;
                  }
                  const moreChip = (
                    <button
                      type="button"
                      className={styles.moreChip}
                      aria-label={`${toTime(meeting.startAt)}에 겹친 회의 ${group.length}개 보기`}
                      onClick={(click) =>
                        setOverlap({
                          title: `${dayLabel(day)} ${toTime(meeting.startAt)} · 회의 ${group.length}개`,
                          meetings: group,
                          anchor: click.currentTarget.getBoundingClientRect(),
                        })
                      }
                    >
                      +{group.length - 1}
                    </button>
                  );
                  // 회의 칸(버튼) 안에 버튼을 넣을 수 없어 같은 자리에 겹친 층을 두고, 시간 줄 오른쪽 끝에 [+N]을 둔다 (2026-11-25 사용자 요청).
                  // 층의 제목은 자리만 잡는 투명 글자다. 칸이 낮아 시간 줄이 안 보이면 제목 줄 오른쪽 끝에 둔다
                  return (
                    <Fragment key={meeting.meetingId}>
                      {event}
                      <span className={`${styles.moreLayer} ${isShort ? styles.moreLayerShort : ''}`} style={{ top, height }}>
                        {isShort ? (
                          moreChip
                        ) : (
                          <>
                            <span className={`${styles.eventTitle} ${styles.placeholder}`} aria-hidden="true">
                              {meeting.title}
                            </span>
                            <span className={styles.moreLine}>{moreChip}</span>
                          </>
                        )}
                      </span>
                    </Fragment>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.monthGrid}>
          {DAY_NAMES.map((name) => (
            <span key={name} className={`${styles.dayName} ${styles.monthDayName}`}>
              {name}
            </span>
          ))}
          {days.map((day) => {
            const items = byDay(day);
            const isOtherMonth = day.getMonth() !== cursor.getMonth();
            return (
              <div key={toIsoDate(day)} className={[styles.monthCell, isOtherMonth ? styles.otherMonth : ''].filter(Boolean).join(' ')}>
                <span className={[styles.monthDate, toIsoDate(day) === today ? styles.isToday : ''].filter(Boolean).join(' ')}>
                  {day.getDate()}
                </span>
                {/* 디자인 HomeMonthViewPage_v6: 1개는 두 줄(시간 위, 제목 아래), 2개 이상은 한 줄씩 2개 + [+N개 더보기] */}
                {items.slice(0, MONTH_EVENT_LIMIT).map((meeting) => (
                  <button
                    key={meeting.meetingId}
                    type="button"
                    className={`${eventClass(meeting)} ${styles.monthEvent} ${items.length === 1 ? styles.monthStacked : ''}`}
                    style={eventStyle(meeting)}
                    aria-label={eventLabel(meeting)}
                    onClick={(event) => setPreview({ meeting, anchor: event.currentTarget.getBoundingClientRect() })}
                  >
                    {/* 시작 시간과 회의명을 한 줄로. 두 줄이면 글자가 잘린다 (QA 2026-11-23) */}
                    <span className={styles.eventMeta}>{toTime(meeting.startAt)}</span>
                    <span className={styles.eventTitle}>{meeting.title}</span>
                  </button>
                ))}
                {items.length > MONTH_EVENT_LIMIT && (
                  <button
                    type="button"
                    className={styles.more}
                    onClick={(click) =>
                      setOverlap({
                        title: `${dayLabel(day)} · 회의 ${items.length}개`,
                        meetings: items,
                        anchor: click.currentTarget.getBoundingClientRect(),
                      })
                    }
                  >
                    +{items.length - MONTH_EVENT_LIMIT}개 더보기
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {overlap && (
        <OverlapEventsPopover
          title={overlap.title}
          meetings={overlap.meetings}
          anchor={overlap.anchor}
          colorOf={(meeting) => folderColor(folders.find(({ folderId }) => folderId === meeting.folderId)?.color)}
          onPick={(meeting, rect) => {
            setOverlap(null);
            setPreview({ meeting, anchor: rect });
          }}
          onClose={closeOverlap}
        />
      )}
      {preview && (
        <MeetingPreviewCard
          meeting={preview.meeting}
          anchor={preview.anchor}
          folderColor={folders.find(({ folderId }) => folderId === preview.meeting.folderId)?.color}
          onOpen={() => navigate(meetingPath(preview.meeting))}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
