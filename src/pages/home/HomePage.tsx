import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { getMeetingDetail, listCalendarMeetings, type MeetingDetailResponse } from '../../api/meeting';
import { listWritingMinutes, type WritingMinutes } from '../../api/minutes';
import { getMe } from '../../api/user';
import { listFavorites, listMyWorkspaces, setFavorite } from '../../api/workspace';
import AppLayout from '../../components/AppLayout';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { Favorite, WorkspaceSummary } from '../../types/workspace';
import { addDays, startOfWeek, toIsoDate } from '../../utils/calendar';
import FavoritesCard from './FavoritesCard';
import HomeCalendar from './HomeCalendar';
import styles from './HomePage.module.css';
import UpcomingMeetingCard from './UpcomingMeetingCard';
import WritingMinutesCard from './WritingMinutesCard';

// 캘린더 API는 한 번에 42일까지 받는다. 이번 주 월요일부터 받아 이번 주 회의 수와 곧 다가오는 회의를 찾는다
const UPCOMING_RANGE_DAYS = 41;
const DAYS_IN_WEEK = 7;

/** REQ-018~020, 141~144 홈 (Figma 23-2 홈(캘린더)) */
export default function HomePage() {
  const [myName, setMyName] = useState('');
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [weekCount, setWeekCount] = useState<number>();
  const [upcoming, setUpcoming] = useState<MeetingDetailResponse | null>();
  const [writing, setWriting] = useState<WritingMinutes[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const showError = useCallback((error: unknown) => setToast({ text: errorMessage(error), variant: 'error' }), []);

  useEffect(() => {
    let isCurrent = true;
    const monday = startOfWeek(new Date());
    const nextMonday = toIsoDate(addDays(monday, DAYS_IN_WEEK));
    const now = new Date();

    getMe()
      .then((me) => isCurrent && setMyName(me.name))
      .catch(() => undefined);
    listMyWorkspaces()
      .then((items) => isCurrent && setWorkspaces(items))
      .catch(showError);
    listCalendarMeetings(toIsoDate(monday), toIsoDate(addDays(monday, UPCOMING_RANGE_DAYS)))
      .then(async (meetings) => {
        if (!isCurrent) {
          return;
        }
        setWeekCount(meetings.filter((meeting) => meeting.startAt < nextMonday).length);
        const next = meetings.find((meeting) => meeting.status === 'SCHEDULED' && new Date(meeting.startAt) >= now);
        const detail = next ? await getMeetingDetail(next.meetingId) : null;
        if (isCurrent) {
          setUpcoming(detail);
        }
      })
      .catch(showError);
    listWritingMinutes()
      .then((items) => isCurrent && setWriting(items))
      .catch(showError);
    listFavorites()
      .then((items) => isCurrent && setFavorites(items))
      .catch(showError);
    return () => {
      isCurrent = false;
    };
  }, [showError]);

  const removeFavorite = async (favorite: Favorite) => {
    try {
      await setFavorite(favorite, false);
      setFavorites((prev) => prev.filter((item) => item !== favorite));
    } catch (error) {
      showError(error);
    }
  };

  return (
    <AppLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <h1 className={styles.greeting}>
        {myName}님, 이번 주에 총 {weekCount ?? 0}개의 회의가 예정되어있습니다
      </h1>
      <div className={styles.top}>
        <HomeCalendar workspaces={workspaces} />
        <div className={styles.side}>
          <UpcomingMeetingCard meeting={upcoming} />
          <WritingMinutesCard items={writing} />
        </div>
      </div>
      <FavoritesCard items={favorites} onRemove={removeFavorite} />
    </AppLayout>
  );
}
