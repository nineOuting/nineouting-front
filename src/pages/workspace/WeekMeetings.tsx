import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCalendarMeetings, type CalendarMeeting } from '../../api/meeting';
import type { FolderSummary } from '../../types/workspace';
import { folderColor } from '../../utils/folderColor';
import { addDays, startOfWeek, toIsoDate, toTime } from '../../utils/calendar';
import { formatMeetingDate } from '../../utils/meetingFormat';
import styles from './WeekMeetings.module.css';

const DAYS_IN_WEEK = 7;

interface WeekMeetingsProps {
  workspaceId: number;
  /** REQ-202 회의 날짜를 프로젝트 색으로 */
  folders: FolderSummary[];
}

/** 진행 중인 회의는 회의 화면으로, 끝난 회의는 회의록으로, 나머지는 대기 화면으로 */
function meetingPath(meeting: CalendarMeeting) {
  if (meeting.status === 'IN_PROGRESS') {
    return `/meetings/${meeting.meetingId}/room`;
  }
  return meeting.status === 'FINISHED' ? `/meetings/${meeting.meetingId}/minutes` : `/meetings/${meeting.meetingId}`;
}

/** REQ-197 워크스페이스 이번 주 회의: 이번 주(월~일)에 이 워크스페이스에서 열리는 회의를 카드로 (날짜, 회의명, 프로젝트, 시간) */
export default function WeekMeetings({ workspaceId, folders }: WeekMeetingsProps) {
  // null이면 불러오는 중
  const [meetings, setMeetings] = useState<CalendarMeeting[] | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const monday = startOfWeek(new Date());
    listCalendarMeetings(toIsoDate(monday), toIsoDate(addDays(monday, DAYS_IN_WEEK - 1)))
      .then((items) => isCurrent && setMeetings(items.filter((item) => item.workspaceId === workspaceId)))
      .catch(() => isCurrent && setMeetings([]));
    return () => {
      isCurrent = false;
    };
  }, [workspaceId]);

  if (meetings === null) {
    return null;
  }
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
        <ul className={styles.list}>
          {meetings.map((meeting) => (
            <li key={meeting.meetingId}>
              <Link to={meetingPath(meeting)} className={styles.card}>
                <span
                  className={styles.date}
                  style={{ color: folderColor(folders.find(({ folderId }) => folderId === meeting.folderId)?.color) }}
                >
                  {formatMeetingDate(meeting.startAt.slice(0, 10))}
                </span>
                <span className={styles.name}>{meeting.title}</span>
                <span className={styles.meta}>
                  {meeting.folderName} · {toTime(meeting.startAt)} - {toTime(meeting.endAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
