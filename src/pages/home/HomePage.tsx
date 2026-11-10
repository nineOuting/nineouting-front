import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { getMeetingDetail, listCalendarMeetings, type MeetingDetailResponse } from '../../api/meeting';
import { listWritingMinutes, type WritingMinutes } from '../../api/minutes';
import { getMe } from '../../api/user';
import { listFavorites, listMyWorkspaces, setFavorite } from '../../api/workspace';
import AppLayout from '../../components/AppLayout';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import Skeleton from '../../components/Skeleton';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { Favorite, WorkspaceSummary } from '../../types/workspace';
import { addDays, startOfWeek, toIsoDate } from '../../utils/calendar';
import FavoritesCard from './FavoritesCard';
import HomeCalendar from './HomeCalendar';
import styles from './HomePage.module.css';
import UpcomingMeetingCard from './UpcomingMeetingCard';
import CreateWorkspaceModal from '../workspace/CreateWorkspaceModal';
import WritingMinutesCard from './WritingMinutesCard';

// 캘린더 API는 한 번에 42일까지 받는다. 이번 주 월요일부터 받아 이번 주 회의 수와 곧 다가오는 회의를 찾는다
const UPCOMING_RANGE_DAYS = 41;
const DAYS_IN_WEEK = 7;
const FAVORITE_SKELETONS = 3;

/** REQ-018~020, 146~153 홈 (nep!nep! 디자인 HomePage) */
export default function HomePage() {
  const [myName, setMyName] = useState('');
  // null이면 아직 불러오는 중
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
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
      .catch((error: unknown) => {
        if (isCurrent) {
          setWorkspaces([]);
          showError(error);
        }
      });
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

  // 디자인 HomeLoadingPage
  if (workspaces === null) {
    return (
      <AppLayout className={styles.page}>
        {toast && <Toast message={toast} onClose={closeToast} />}
        <Skeleton width={320} height={32} />
        <div className={styles.top}>
          <Skeleton height={620} />
          <div className={styles.side}>
            <Skeleton height={300} />
            <Skeleton height={300} />
          </div>
        </div>
        <div className={styles.skeletonRow}>
          {Array.from({ length: FAVORITE_SKELETONS }, (_, index) => (
            <Skeleton key={index} width={240} height={96} />
          ))}
        </div>
      </AppLayout>
    );
  }

  // 디자인 NewUserHomePage: 워크스페이스가 하나도 없을 때
  if (workspaces.length === 0) {
    return (
      <AppLayout className={styles.page}>
        {toast && <Toast message={toast} onClose={closeToast} />}
        <EmptyState
          className={styles.newUser}
          title="첫 워크스페이스를 만들어 보세요"
          description="워크스페이스에서 팀과 프로젝트 폴더, 회의록을 함께 관리해요"
          action={
            <Button variant="primary" size="md" onClick={() => setIsCreatingWorkspace(true)}>
              새 워크스페이스 만들기
            </Button>
          }
          note="초대를 받았다면 메일 속 링크를 눌러 주세요"
        />
        {isCreatingWorkspace && <CreateWorkspaceModal onClose={() => setIsCreatingWorkspace(false)} />}
      </AppLayout>
    );
  }

  return (
    <AppLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      {/* REQ-146 와이어프레임 문구, 0개면 MSG-047 */}
      <h1 className={styles.greeting}>
        {weekCount
          ? `${myName}님, 이번 주에 회의가 ${weekCount}개 있어요`
          : `${myName}님, 이번 주에 예정된 회의가 없어요`}
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
