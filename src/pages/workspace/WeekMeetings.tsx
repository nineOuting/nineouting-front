import { useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { CalendarMeeting } from '../../api/meeting';
import nextIcon from '../../assets/icons/carousel-next.svg';
import prevIcon from '../../assets/icons/carousel-prev.svg';
import Icon from '../../components/Icon';
import Skeleton from '../../components/Skeleton';
import type { FolderSummary } from '../../types/workspace';
import { folderIconColor, folderSubtleColor } from '../../utils/folderColor';
import { toTime } from '../../utils/calendar';
import type { BackState } from '../../utils/meetingFormat';
import styles from './WeekMeetings.module.css';

// 피그마 UpcomingSection: 카드 3개씩 보이고 좌우 버튼으로 하나씩 넘긴다 (QA 2026-11-23)
const VISIBLE_COUNT = 3;
const ARROW_ICON_SIZE = 24;
// 디자인 MeetingCard 높이 (불러오는 동안 같은 자리를 잡아 둔다)
const CARD_HEIGHT = 82;
const ARROW_SIZE = 32;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 2026-11-17T09:00 → 화 */
const weekdayOf = (startAt: string) => WEEKDAYS[new Date(startAt.slice(0, 10) + 'T00:00:00').getDay()];

interface WeekMeetingsProps {
  /** 이번 주 회의. 워크스페이스 화면이 다른 내용과 함께 불러와 넘긴다 (뒤늦게 끼어들어 아래가 밀리지 않게) */
  meetings: CalendarMeeting[];
  /** REQ-202 회의 날짜를 프로젝트 색으로 */
  folders: FolderSummary[];
}

/** 불러오는 동안 이번 주 회의 자리: 제목 줄과 카드 3개를 실제 크기로 잡아 둔다 */
export function WeekMeetingsSkeleton() {
  return (
    <section className={styles.section} aria-hidden="true">
      <div className={styles.head}>
        <Skeleton width={82} height={24} />
      </div>
      <div className={styles.carousel}>
        <Skeleton width={ARROW_SIZE} height={ARROW_SIZE} />
        <div className={styles.viewport}>
          <ul className={styles.list}>
            {Array.from({ length: VISIBLE_COUNT }, (_, index) => (
              <li key={index}>
                <Skeleton height={CARD_HEIGHT} />
              </li>
            ))}
          </ul>
        </div>
        <Skeleton width={ARROW_SIZE} height={ARROW_SIZE} />
      </div>
    </section>
  );
}

/** 진행 중인 회의는 회의 화면으로, 끝난 회의는 회의록으로, 나머지는 대기 화면으로 */
function meetingPath(meeting: CalendarMeeting) {
  if (meeting.status === 'IN_PROGRESS') {
    return `/meetings/${meeting.meetingId}/room`;
  }
  // 끝난 회의는 대기 화면이 회의록 확인 화면으로 바뀌어 있다 (REQ-175)
  return `/meetings/${meeting.meetingId}`;
}

/** REQ-197 워크스페이스 이번 주 회의: 이번 주(월~일)에 이 워크스페이스에서 열리는 회의를 카드로 (날짜, 회의명, 프로젝트, 시간) */
export default function WeekMeetings({ meetings, folders }: WeekMeetingsProps) {
  // 끝난 회의의 회의록 확인에서 뒤로 가면 이 워크스페이스 화면으로 (SCRUM-366)
  const location = useLocation();
  // 보이는 첫 카드 위치 (워크스페이스가 바뀌면 화면이 key로 새로 그려 0부터)
  const [start, setStart] = useState(0);

  const colorOf = (meeting: CalendarMeeting) => folders.find(({ folderId }) => folderId === meeting.folderId)?.color;

  return (
    <section className={styles.section} aria-labelledby="week-meetings-title">
      <div className={styles.head}>
        <h2 id="week-meetings-title" className={styles.title}>
          이번 주 회의
        </h2>
        <span className={styles.count}>총 {meetings.length}개</span>
      </div>
      {meetings.length === 0 ? (
        <p className={styles.empty}>이번 주에 예정된 회의가 없어요</p>
      ) : (
        <div className={styles.carousel}>
        {/* 3개 이하면 넘길 것이 없어 두 버튼 모두 비활성 */}
        <button
          type="button"
          className={styles.arrow}
          aria-label="이전 회의"
          disabled={start === 0}
          onClick={() => setStart((value) => Math.max(0, value - 1))}
        >
          <Icon src={prevIcon} size={ARROW_ICON_SIZE} />
        </button>
        {/* 카드를 한 줄로 두고 보이는 칸만 옮겨 부드럽게 넘어간다. 화면 밖 카드는 inert로 키보드에서도 뺀다 */}
        <div className={styles.viewport}>
        <ul className={styles.list} style={{ '--start': start } as CSSProperties}>
          {meetings.map((meeting, index) => (
            <li key={meeting.meetingId} inert={index < start || index >= start + VISIBLE_COUNT}>
              {/* 피그마 Page 8 MeetingCard: 날짜 상자(프로젝트 색) + 회의명, 프로젝트 · 시간 */}
              <Link to={meetingPath(meeting)} state={{ backTo: location.pathname } satisfies BackState} className={styles.card}>
                <span
                  className={styles.dateBox}
                  style={{ background: folderSubtleColor(colorOf(meeting)), color: folderIconColor(colorOf(meeting)) }}
                >
                  <span className={styles.day}>{Number(meeting.startAt.slice(8, 10))}</span>
                  <span className={styles.weekday}>{weekdayOf(meeting.startAt)}</span>
                </span>
                <span className={styles.texts}>
                  <span className={styles.name}>{meeting.title}</span>
                  <span className={styles.meta}>
                    {meeting.folderName} · {toTime(meeting.startAt)}~{toTime(meeting.endAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        </div>
        <button
          type="button"
          className={styles.arrow}
          aria-label="다음 회의"
          disabled={start + VISIBLE_COUNT >= meetings.length}
          onClick={() => setStart((value) => Math.min(meetings.length - VISIBLE_COUNT, value + 1))}
        >
          <Icon src={nextIcon} size={ARROW_ICON_SIZE} />
        </button>
        </div>
      )}
    </section>
  );
}
