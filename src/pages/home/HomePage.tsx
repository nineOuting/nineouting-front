import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import {
  completeMyTodo,
  getMeetingDetail,
  listCalendarMeetings,
  listMyTodos,
  type MeetingDetailResponse,
  type MyTodo,
} from '../../api/meeting';
import { listWritingMinutes, type WritingMinutes } from '../../api/minutes';
import { getMe } from '../../api/user';
import { listFavorites, listFolders, listMyWorkspaces, setFavorite } from '../../api/workspace';
import AppLayout from '../../components/AppLayout';
// 레거시 (2026-11-22, 피그마 프론트에 창 디자인이 없어 막음): 새 워크스페이스 만들기 창
// import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import Skeleton from '../../components/Skeleton';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { Favorite, WorkspaceSummary } from '../../types/workspace';
import { addDays, startOfWeek, toIsoDate } from '../../utils/calendar';
import FavoritesCard from './FavoritesCard';
import HomeCalendar from './HomeCalendar';
import styles from './HomePage.module.css';
import UpcomingMeetingCard from './UpcomingMeetingCard';
// 레거시 (2026-11-22, 피그마 프론트에 창 디자인이 없어 막음): 새 워크스페이스 만들기 창
// import CreateWorkspaceModal from '../workspace/CreateWorkspaceModal';
import MyTodosCard from './MyTodosCard';
import type { FolderOption } from './ProjectFilter';
import WritingMinutesCard from './WritingMinutesCard';

// 캘린더 API는 한 번에 42일까지 받는다. 이번 주 월요일부터 받아 이번 주 회의 수와 곧 다가오는 회의를 찾는다
const UPCOMING_RANGE_DAYS = 41;
const DAYS_IN_WEEK = 7;
/** 불러오는 동안 회색 자리 크기: 다 불러온 화면의 인사(32), 곧 다가오는 회의 띠(86), 달력 제목(26), 오른쪽 열 카드 3개 */
const SKELETON = {
  greetingWidth: 360,
  greetingHeight: 32,
  upcomingHeight: 86,
  calendarTitleWidth: 96,
  calendarTitleHeight: 26,
  panelCardHeights: [158, 240, 246],
};

/** REQ-018~020, 146~153 홈 (nep!nep! 디자인 HomePage) */
export default function HomePage() {
  const [searchParams] = useSearchParams();
  // HomeCalendar가 주간/월간을 주소(?view=month)에 둔다
  const isMonthView = searchParams.get('view') === 'month';
  const [myName, setMyName] = useState('');
  // null이면 아직 불러오는 중
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  // 레거시 (2026-11-22, 피그마 프론트에 창 디자인이 없어 막음): 새 워크스페이스 만들기 창
  // const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [weekCount, setWeekCount] = useState<number>();
  const [upcoming, setUpcoming] = useState<MeetingDetailResponse | null>();
  const [writing, setWriting] = useState<WritingMinutes[]>([]);
  // 달력 프로젝트 필터와 작성 중인 회의록의 폴더 색에 같이 쓴다
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [todos, setTodos] = useState<MyTodo[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const showError = useCallback((error: unknown) => setToast({ text: errorMessage(error), variant: 'error' }), []);

  // 홈에 보이는 내용을 모두 받은 뒤 한 번에 그린다. 따로 받으면 내 할 일, 곧 다가오는 회의 띠가 뒤늦게 끼어들어
  // 달력과 작성 중인 회의록이 밀린다 (SCRUM-434). 하나가 실패해도 나머지는 그린다
  useEffect(() => {
    let isCurrent = true;
    const monday = startOfWeek(new Date());
    const nextMonday = toIsoDate(addDays(monday, DAYS_IN_WEEK));
    const now = new Date();
    const orEmpty = <T,>(fallback: T) => (error: unknown) => {
      if (isCurrent) {
        showError(error);
      }
      return fallback;
    };

    const load = async () => {
      const [me, mine, meetings, writingItems, favoriteItems, todoItems] = await Promise.all([
        getMe().catch(() => null),
        listMyWorkspaces().catch(orEmpty<WorkspaceSummary[]>([])),
        listCalendarMeetings(toIsoDate(monday), toIsoDate(addDays(monday, UPCOMING_RANGE_DAYS))).catch(orEmpty(null)),
        listWritingMinutes().catch(orEmpty<WritingMinutes[]>([])),
        listFavorites().catch(orEmpty<Favorite[]>([])),
        listMyTodos().catch(orEmpty<MyTodo[]>([])),
      ]);
      const next = meetings?.find((meeting) => meeting.status === 'SCHEDULED' && new Date(meeting.startAt) >= now);
      // 워크스페이스가 여럿이면 같은 이름의 폴더를 구분하도록 워크스페이스 이름을 앞에 붙인다
      const withWorkspaceName = mine.length > 1;
      const [detail, folderLists] = await Promise.all([
        next ? getMeetingDetail(next.meetingId).catch(orEmpty(null)) : null,
        Promise.all(
          mine.map(({ workspaceId, name }) =>
            listFolders(workspaceId)
              .then((items) =>
                items.map((folder) => ({
                  folderId: folder.folderId,
                  label: withWorkspaceName ? `${name} · ${folder.name}` : folder.name,
                  color: folder.color,
                })),
              )
              .catch(() => []),
          ),
        ),
      ]);
      if (!isCurrent) {
        return;
      }
      setMyName(me?.name ?? '');
      if (meetings) {
        setWeekCount(meetings.filter((meeting) => meeting.startAt < nextMonday).length);
        setUpcoming(detail);
      }
      setWriting(writingItems);
      setFavorites(favoriteItems);
      setTodos(todoItems);
      setFolders(folderLists.flat());
      setWorkspaces(mine);
    };
    void load();
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

  // REQ-196 고른 할 일을 완료하고 목록에서 뺀다. 실패한 것은 남긴다
  const completeTodos = async (picked: MyTodo[]) => {
    const results = await Promise.allSettled(picked.map((todo) => completeMyTodo(todo.meetingId, todo.itemId)));
    const done = picked.filter((_, index) => results[index].status === 'fulfilled');
    setTodos((prev) => prev.filter((todo) => !done.includes(todo)));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) {
      showError(failed.reason);
    }
  };

  // 디자인 HomeLoadingPage. 다 불러온 화면과 같은 배치(왼쪽 인사, 곧 다가오는 회의 띠, 달력 / 오른쪽 열 카드 3개)로 자리를 잡는다
  if (workspaces === null) {
    return (
      <AppLayout className={styles.homeLayout} fitScreen>
        {toast && <Toast message={toast} onClose={closeToast} />}
        <div className={styles.main} aria-hidden="true">
          <Skeleton width={SKELETON.greetingWidth} height={SKELETON.greetingHeight} />
          <Skeleton height={SKELETON.upcomingHeight} />
          <div className={styles.calendarSection}>
            <Skeleton width={SKELETON.calendarTitleWidth} height={SKELETON.calendarTitleHeight} />
            <Skeleton height="auto" className={styles.calendarSkeleton} />
          </div>
        </div>
        <div className={styles.panel} aria-hidden="true">
          {SKELETON.panelCardHeights.map((height, index) => (
            <Skeleton key={index} height={height} className={styles.panelSkeleton} />
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
          // 레거시 (2026-11-22, 피그마 프론트에 창 디자인이 없어 막음): 새 워크스페이스 만들기 창
          // action={
          //   <Button variant="primary" size="md" onClick={() => setIsCreatingWorkspace(true)}>
          //     새 워크스페이스 만들기
          //   </Button>
          // }
          note="초대를 받았다면 메일 속 링크를 눌러 주세요"
        />
        {/* 레거시 (2026-11-22, 피그마 프론트에 창 디자인이 없어 막음): 새 워크스페이스 만들기 창
        {isCreatingWorkspace && <CreateWorkspaceModal onClose={() => setIsCreatingWorkspace(false)} />}
        */}
      </AppLayout>
    );
  }

  // 피그마 Page 8 HomePage_v6: 왼쪽은 인사, 곧 다가오는 회의 띠, 이번 주 일정. 오른쪽 열은 즐겨찾기, 내 할 일, 작성 중인 회의록
  return (
    <AppLayout className={styles.homeLayout} fitScreen>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <div className={styles.main}>
        {/* REQ-146 와이어프레임 문구, 0개면 MSG-047 */}
        <h1 className={styles.greeting}>
          {weekCount
            ? `${myName}님, 이번 주에 회의가 ${weekCount}개 있어요`
            : `${myName}님, 이번 주에 예정된 회의가 없어요`}
        </h1>
        <UpcomingMeetingCard meeting={upcoming} />
        <section className={styles.calendarSection} aria-labelledby="week-schedule-title">
          <h2 id="week-schedule-title" className={styles.sectionTitle}>
            {/* 피그마 HomeMonthViewPage_v6: 월간이면 "이번 달 일정" */}
            {isMonthView ? '이번 달 일정' : '이번 주 일정'}
          </h2>
          <HomeCalendar folders={folders} />
        </section>
      </div>
      <aside className={styles.panel}>
        <FavoritesCard items={favorites} onRemove={removeFavorite} />
        <MyTodosCard items={todos} onComplete={completeTodos} />
        <WritingMinutesCard items={writing} folders={folders} />
      </aside>
    </AppLayout>
  );
}
