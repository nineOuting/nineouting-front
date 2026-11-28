import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import {
  discardPendingAgenda,
  getFolderMeetingStats,
  getMeetingDetail,
  listFolderMeetingRows,
  listFolderPendingAgendas,
  MEETING_ERROR_CODES,
  PENDING_AGENDA_UNAVAILABLE_MESSAGE,
  restoreMeeting,
  restorePendingAgenda,
  toMeeting,
  trashMeeting,
  type FolderMeetingStat,
} from '../../api/meeting';
import {
  addFolderMember,
  changeFolderColor,
  deleteFolder,
  getFolder,
  getWorkspace,
  leaveFolder,
  listFolderMemberDetails,
  listWorkspaceMembers,
  removeFolderMember,
  renameFolder,
  transferFolderOwnership,
  type FolderInfo,
} from '../../api/workspace';
import emptyCharacter from '../../assets/characters/empty.svg';
import addIcon from '../../assets/icons/add-sm.svg';
import folderIcon from '../../assets/icons/folder-md.svg';
import separatorIcon from '../../assets/icons/breadcrumb-sep.svg';
import { useAppShell } from '../../components/useAppShell';
import ConfirmDialog from '../../components/ConfirmDialog';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
// 레거시 (2026-11-25, 피그마 11/24: [멤버 N명]은 멤버 관리 창을 연다): 보기 전용 멤버 목록 팝오버
// import MemberListPopover from '../../components/MemberListPopover';
import Skeleton from '../../components/Skeleton';
import { peekFolder } from '../../components/sidebarCache';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { FolderMeeting, FolderMember, FolderPendingAgenda, WorkspaceMember } from '../../types/workspace';
import moreIcon from '../../assets/icons/more-vert.svg';
import deleteIcon from '../../assets/icons/delete.svg';
import editIcon from '../../assets/icons/edit.svg';
import linkIcon from '../../assets/icons/link.svg';
import logoutIcon from '../../assets/icons/logout.svg';
import settingsIcon from '../../assets/icons/settings.svg';
// 레거시 (2026-11-25, 피그마 코멘트 "다른 폴더로 이동 삭제"): 회의 줄 ⋮ [다른 폴더로 이동]
// import MoveMeetingModal from '../../components/MoveMeetingModal';
import ActionMenu from '../workspace/ActionMenu';
import TransferOwnerDialog from '../workspace/TransferOwnerDialog';
import FolderCalendar from './FolderCalendar';
import FolderStats from './FolderStats';
// 레거시 (2026-11-25, 피그마 11/24: 색은 프로젝트 설정 창에서 고른다): ⋮ [프로젝트 색 설정] 팝오버
// import ProjectColorPicker from './ProjectColorPicker';
import FolderMembersModal from './FolderMembersModal';
import ProjectSettingsModal from './ProjectSettingsModal';
import MeetingTable, { type MeetingSort, type SortKey } from './MeetingTable';
import AccessNotice from '../../components/AccessNotice';
import { accessNoticeOf, type AccessNoticeKind } from '../../utils/accessNotice';
import { folderColor, folderIconColor, folderSubtleColor } from '../../utils/folderColor';
import styles from './FolderPage.module.css';

const SEPARATOR_ICON_SIZE = 16;
const BUTTON_ICON_SIZE = 20;
const MORE_ICON_SIZE = 24;
/** 불러오는 동안 회색 자리 크기 (다 불러온 화면: 폴더 이름 줄 20, 색 아이콘 32, 제목 32, 요약 줄 32) */
const SKELETON = {
  crumbWidth: 64,
  lineHeight: 20,
  colorIcon: 32,
  titleWidth: 200,
  titleHeight: 32,
  // 숫자 한 자리 너비, 글자 줄보다 낮게 (끼운 줄이 높아지지 않게)
  countWidth: 8,
  countHeight: 16,
  textHeight: 20,
  badgeWidth: 44,
  badgeHeight: 24,
};
/**
 * 회의 목록이 비었을 때의 화면. 불러오는 동안에도 회색 줄 대신 이 화면을 먼저 보인다.
 * 고른 날짜(?day=)가 있으면 그날 회의가 없다는 문구, 없으면 MSG-034 (와이어프레임 ProjectEmptyPage 문구).
 * 아이콘 대신 넵넵 캐릭터 (QA 2026-11-24, 피그마 2172:138386)
 */
function meetingEmpty(selectedDay: string | null, onCreate: () => void): ReactNode {
  if (selectedDay) {
    return (
      <EmptyState
        character={emptyCharacter}
        title={`${Number(selectedDay.slice(5, 7))}월 ${Number(selectedDay.slice(8, 10))}일에는 회의가 없어요`}
        description="다른 날짜를 고르거나 날짜 선택을 풀어 보세요"
      />
    );
  }
  return (
    <EmptyState
      character={emptyCharacter}
      title="아직 회의가 없어요"
      description="첫 회의를 만들고 안건을 정리해 보세요"
      action={
        <Button variant="primary" size="md" onClick={onCreate}>
          새 회의 만들기
        </Button>
      }
    />
  );
}

// REQ-167 정렬 메뉴: 최신순(기본), 오래된순, 회의명순
const SORT_OPTIONS: { value: string; label: string; sort: MeetingSort }[] = [
  { value: 'newest', label: '최신순', sort: { key: 'date', isAscending: false } },
  { value: 'oldest', label: '오래된순', sort: { key: 'date', isAscending: true } },
  { value: 'title', label: '회의명순', sort: { key: 'title', isAscending: true } },
];
const SORT_KEYS: SortKey[] = ['title', 'date', 'status', 'writer'];

/** 주소의 ?sort=date&asc=0&page=2 를 읽는다 (REQ-180 뒤로 가기에도 정렬, 페이지가 남는다) */
function sortOf(params: URLSearchParams): MeetingSort {
  const key = params.get('sort') as SortKey | null;
  return key && SORT_KEYS.includes(key) ? { key, isAscending: params.get('asc') === '1' } : SORT_OPTIONS[0].sort;
}

type Dialog =
  | { type: 'members' }
  | { type: 'leave' }
  | { type: 'settings' }
  | { type: 'transfer' }
  | { type: 'deleteFolder' };

/** 받침이 있으면 '을', 없으면 '를' (토스트 "'킥오프 회의'를 삭제했어요.") */
function objectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? '을' : '를';
}

/** 진행 중이면 회의방, 아니면 대기 화면 (끝난 회의는 회의록 확인 화면으로 바뀌어 있다, REQ-175) */
function meetingPath({ meetingId, status }: FolderMeeting) {
  return status === 'inProgress' ? `/meetings/${meetingId}/room` : `/meetings/${meetingId}`;
}

/**
 * REQ-041~058, 139 프로젝트 폴더 화면 (회의 목록·멤버·남은 안건).
 * 디자인에는 하위 폴더와 [새 폴더]가 있지만 기획서 REQ-040 "폴더 안에 폴더는 불가능"에 따라
 * workspace-service가 만들지 않으므로(FOLDER_DEPTH_EXCEEDED) 화면에서 뺐다 (docs/backlog.md)
 */
export default function FolderPage() {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const id = Number(folderId);
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = sortOf(searchParams);
  const page = Math.max(0, Number(searchParams.get('page') ?? '1') - 1);
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const folderMenuRef = useRef<HTMLButtonElement>(null);
  // 레거시 (2026-11-25, 피그마 11/24: [멤버 N명]은 멤버 관리 창을 연다): 보기 전용 멤버 목록 팝오버
  // const memberListRef = useRef<HTMLButtonElement>(null);
  // const [isMemberListOpen, setIsMemberListOpen] = useState(false);
  // 즐겨찾기 버튼은 스스로 상태를 불러오므로 메뉴에서 바꾸면 다시 그린다
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [meetings, setMeetings] = useState<FolderMeeting[]>([]);
  const [members, setMembers] = useState<FolderMember[]>([]);
  const [pendingAgendas, setPendingAgendas] = useState<FolderPendingAgenda[]>([]);
  const [stats, setStats] = useState<FolderMeetingStat[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[] | null>(null);
  const [workspaceMembersError, setWorkspaceMembersError] = useState<string>();
  // 워크스페이스 소유자는 모든 폴더에 들어가고, 폴더 삭제와 멤버 초대, 제외를 한다 (2026-11-16 결정)
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false);
  // REQ-205 권한 없는 폴더 링크
  const [accessNotice, setAccessNotice] = useState<AccessNoticeKind | null>(null);
  // 폴더 멤버 초대, 제외는 폴더 소유자와 워크스페이스 소유자, 다른 멤버는 목록 조회만 (2026-11-16 결정)
  const canManageMembers = isWorkspaceOwner || Boolean(folder?.isOwner);
  // 프로젝트 설정(이름, 색), 폴더 삭제도 프로젝트 소유자와 워크스페이스 소유자 (피그마 11/24 코멘트)
  const canEditSettings = canManageMembers;
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const location = useLocation();
  // 워크스페이스에서 새 폴더를 만들고 오면 MSG-093 안내를 띄운다
  const [toast, setToast] = useState<ToastMessage | null>(() => {
    const created = (location.state as { toast?: string } | null)?.toast;
    return created ? { text: created, variant: 'success' } : null;
  });
  const closeToast = useCallback(() => setToast(null), []);
  const closeDialog = () => setDialog(null);
  const notice = (text: string) => setToast({ text, variant: 'info' });
  const showError = useCallback((error: unknown) => setToast({ text: errorMessage(error), variant: 'error' }), []);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const [info, rows, folderMembers, pending, meetingStats] = await Promise.all([
        getFolder(id),
        listFolderMeetingRows(id),
        listFolderMemberDetails(id),
        listFolderPendingAgendas(id),
        // REQ-200 그래프는 실패해도 화면은 보인다
        getFolderMeetingStats(id).catch(() => []),
      ]);
      const workspace = await getWorkspace(info.workspaceId);
      if (!isCurrent) {
        return;
      }
      setIsWorkspaceOwner(workspace.isOwner);
      setFolder(info);
      setMeetings(rows);
      setMembers(folderMembers);
      setPendingAgendas(pending);
      setStats(meetingStats);
    };
    load().catch((error: unknown) => {
      if (isCurrent) {
        const notice = accessNoticeOf(error);
        if (notice) {
          setAccessNotice(notice);
        } else {
          showError(error);
        }
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [id, showError]);

  // REQ-188 남은 안건 삭제 (MSG-081, [되돌리기])
  const discardPending = async (agenda: FolderPendingAgenda) => {
    try {
      await discardPendingAgenda(id, agenda.pendingAgendaId);
      setPendingAgendas((prev) => prev.filter(({ pendingAgendaId }) => pendingAgendaId !== agenda.pendingAgendaId));
      const undo = async () => {
        try {
          await restorePendingAgenda(id, agenda.pendingAgendaId);
          setPendingAgendas(await listFolderPendingAgendas(id));
        } catch (error) {
          showError(error);
        }
      };
      setToast({ text: '남은 안건에서 삭제했어요', variant: 'info', action: { label: '되돌리기', onClick: () => void undo() } });
    } catch (error) {
      if (isApiError(error, MEETING_ERROR_CODES.pendingAgendaUnavailable)) {
        setToast({ text: PENDING_AGENDA_UNAVAILABLE_MESSAGE, variant: 'error' });
        return;
      }
      showError(error);
    }
  };

  const openMembers = async () => {
    setDialog({ type: 'members' });
    if (!folder || !canManageMembers || workspaceMembers) {
      return;
    }
    // REQ-041 폴더에는 워크스페이스 멤버만 초대한다
    try {
      setWorkspaceMembers(await listWorkspaceMembers(folder.workspaceId));
    } catch (error) {
      setWorkspaceMembersError(errorMessage(error));
    }
  };

  const reloadMembers = async () => setMembers(await listFolderMemberDetails(id));

  /** REQ-043 넘기면 나는 폴더 멤버로 남는다. 이제 폴더에서 나갈 수 있다 */
  const transferOwnership = async (userId: number) => {
    // 서버는 폴더에 초대된 멤버에게만 넘긴다. "모든 폴더" 권한으로 들어온 멤버는 먼저 폴더에 초대해 둔다 (2026-11-25, 후보가 0명이던 문제)
    if (members.find((member) => member.userId === userId)?.isInherited) {
      await addFolderMember(id, userId);
    }
    await transferFolderOwnership(id, userId);
    setFolder((prev) => prev && { ...prev, isOwner: false });
    closeDialog();
    const newOwner = members.find((member) => member.userId === userId);
    notice(`${newOwner?.name ?? '선택한 멤버'} 님에게 소유권을 넘겼어요.`); // MSG-092
    await reloadMembers().catch(() => undefined);
  };
  const reloadMeetings = async () => setMeetings(await listFolderMeetingRows(id));

  const changeView = (next: { sort?: MeetingSort; page?: number }) => {
    const params = new URLSearchParams(searchParams);
    const nextSort = next.sort ?? sort;
    params.set('sort', nextSort.key);
    params.set('asc', nextSort.isAscending ? '1' : '0');
    params.set('page', String((next.page ?? (next.sort ? 0 : page)) + 1));
    setSearchParams(params, { replace: true });
  };

  // REQ-201 달력에서 고른 날 (그날 회의만 본다). 뒤로 가기에도 남게 주소에 둔다 (REQ-180)
  const selectedDay = searchParams.get('day');
  const shownMeetings = selectedDay ? meetings.filter(({ date }) => date === selectedDay) : meetings;
  const selectDay = (day: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (day) {
      params.set('day', day);
    } else {
      params.delete('day');
    }
    params.set('page', '1');
    setSearchParams(params, { replace: true });
  };

  // REQ-166 회의 삭제: 쓰레기통으로. 토스트의 [되돌리기]는 5초 (MSG-063)
  const removeMeeting = async (meeting: FolderMeeting) => {
    try {
      await trashMeeting(meeting.meetingId);
      setMeetings((prev) => prev.filter(({ meetingId }) => meetingId !== meeting.meetingId));
      setToast({
        text: `'${meeting.title}'${objectParticle(meeting.title)} 삭제했어요.`,
        variant: 'info',
        action: {
          label: '되돌리기',
          onClick: () => {
            restoreMeeting(meeting.meetingId)
              .then(reloadMeetings)
              .catch(showError);
          },
        },
      });
    } catch (error) {
      showError(error);
    }
  };

  // REQ-166 링크 복사 (MSG-064)
  const copyMeetingLink = async (meeting: FolderMeeting) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${meetingPath(meeting)}`);
      setToast({ text: '링크를 복사했어요.', variant: 'success' });
    } catch {
      showError(new Error('링크를 복사하지 못했어요. 다시 시도해 주세요.'));
    }
  };

  // 수정 창은 회의 정보를 넘겨받아 연다 (없으면 대기 화면으로 돌아간다)
  const openEdit = async (meeting: FolderMeeting) => {
    try {
      const detail = toMeeting(await getMeetingDetail(String(meeting.meetingId)));
      navigate(`/meetings/${meeting.meetingId}/edit`, { state: { meeting: detail } });
    } catch (error) {
      showError(error);
    }
  };

  const meetingMenu = (meeting: FolderMeeting) => [
    // REQ-064 회의 정보 수정은 시작 전에만
    ...(meeting.status === 'scheduled'
      ? [{ label: '회의 정보 수정', icon: editIcon, onSelect: () => void openEdit(meeting) }]
      : []),
    // 레거시 (2026-11-25, 피그마 코멘트 "다른 폴더로 이동 삭제"): { label: '다른 폴더로 이동', onSelect: () => setDialog({ type: 'move', meeting }) },
    { label: '링크 복사', icon: linkIcon, onSelect: () => void copyMeetingLink(meeting) },
    // 피그마 04 프로젝트 "회의 줄 ⋮ 메뉴" (11/24): 아이콘, 삭제 앞에 선
    ...(meeting.status === 'inProgress'
      ? []
      : [{ label: '회의 삭제', icon: deleteIcon, isDanger: true, hasDividerBefore: true, onSelect: () => void removeMeeting(meeting) }]),
  ];

  // REQ-153 폴더 메뉴의 [즐겨찾기에 추가]
  const addMembers = async (userIds: number[]) => {
    try {
      for (const userId of userIds) {
        await addFolderMember(id, userId);
      }
      // MSG-096
      setToast({ text: `멤버 ${userIds.length}명을 프로젝트에 추가했어요.`, variant: 'success' });
    } finally {
      await reloadMembers();
    }
  };

  const removeMembers = async (userIds: number[]) => {
    try {
      for (const userId of userIds) {
        await removeFolderMember(id, userId);
      }
    } finally {
      await reloadMembers();
    }
  };

  const leave = async () => {
    closeDialog();
    try {
      await leaveFolder(id);
      navigate(`/workspaces/${folder?.workspaceId}`, { replace: true });
    } catch (error) {
      showError(error);
    }
  };

  // REQ-058 폴더 삭제 (⋮ [폴더 삭제], 프로젝트 소유자, 워크스페이스 소유자). 쓰레기통으로 가고 워크스페이스로 돌아간다
  const removeFolder = async () => {
    closeDialog();
    try {
      await deleteFolder(id);
      navigate(`/workspaces/${folder?.workspaceId}`, { replace: true });
    } catch (error) {
      showError(error);
    }
  };

  // REQ-165, 202 프로젝트 설정 저장: 바뀐 것만 보낸다. 실패하면 던져 창 안에 보인다
  const saveSettings = async ({ name, color }: { name?: string; color?: number }) => {
    if (name !== undefined) {
      await renameFolder(id, name);
    }
    if (color !== undefined) {
      await changeFolderColor(id, color);
    }
    setFolder((prev) => prev && { ...prev, ...(name !== undefined && { name }), ...(color !== undefined && { color }) });
    closeDialog();
  };

  // 공통 틀에 본문 클래스와 이 폴더의 워크스페이스(폴더 정보를 받은 뒤)를 알린다
  useAppShell({ className: styles.page, workspaceId: folder?.workspaceId });

  if (accessNotice) {
    return (
      <>
        <AccessNotice kind={accessNotice} />
        {/* 새 회의 창 (하위 라우트 meetings/new) */}
        <Outlet />
      </>
    );
  }
  // REQ-178 불러오는 동안: 다 불러온 화면과 같은 배치. 고정 글자와 버튼(경로 "워크스페이스", [새 회의], "회의 목록",
  // [회의록 아카이브], 달력, 회의 표 머리)은 진짜로, 통계 카드는 데이터 없는 화면으로, 받아야 아는 값(요약 숫자, 그리고 모를 때의 폴더 이름·색)만 회색
  if (!folder) {
    // 앱 안에서 옮겨 왔으면 사이드 바가 받아 둔 폴더 이름과 색을 바로 그린다. 새로고침·주소로 바로 왔거나
    // 사이드 바에 펼친 적 없는 워크스페이스의 폴더면 몰라서 회색
    const known = peekFolder(id);
    return (
      <>
        {toast && <Toast message={toast} onClose={closeToast} />}
        <div className={styles.head} aria-busy="true">
          <nav className={styles.breadcrumb} aria-label="현재 위치">
            <span className={styles.crumb}>워크스페이스</span>
            <Icon src={separatorIcon} size={SEPARATOR_ICON_SIZE} className={styles.separator} />
            {known ? (
              <span aria-current="page" className={styles.current}>
                {known.name}
              </span>
            ) : (
              <Skeleton width={SKELETON.crumbWidth} height={SKELETON.lineHeight} />
            )}
          </nav>
          <div className={styles.titleRow}>
            <div className={styles.titleGroup}>
              {known ? (
                <>
                  <span
                    className={styles.colorIcon}
                    style={{ background: folderSubtleColor(known.color), color: folderIconColor(known.color) }}
                    aria-hidden="true"
                  >
                    <Icon src={folderIcon} size={BUTTON_ICON_SIZE} />
                  </span>
                  <h1 className={styles.title}>{known.name}</h1>
                </>
              ) : (
                <>
                  <Skeleton width={SKELETON.colorIcon} height={SKELETON.colorIcon} />
                  <Skeleton width={SKELETON.titleWidth} height={SKELETON.titleHeight} />
                </>
              )}
            </div>
            <div className={styles.titleActions}>
              {/* 폴더 id는 주소에 있어 불러오기 전에도 새 회의를 열 수 있다 */}
              <button type="button" className={styles.primaryButton} onClick={() => navigate(`/folders/${folderId}/meetings/new`)}>
                <Icon src={addIcon} size={BUTTON_ICON_SIZE} />새 회의
              </button>
              {/* ⋮ 폴더 메뉴는 권한을 받아야 알지만 대부분 보이므로 자리를 비활성으로 그린다.
                  없으면 [새 회의]가 오른쪽 끝에 붙었다가 받은 뒤 ⋮ 자리만큼 왼쪽으로 돌아온다 */}
              <span className={styles.menuAnchor}>
                <button type="button" className={styles.iconButton} aria-label="폴더 메뉴" disabled>
                  <Icon src={moreIcon} size={MORE_ICON_SIZE} />
                </button>
              </span>
            </div>
          </div>
        </div>
        {/* 요약 줄: 라벨, 구분선은 진짜로, 받아야 아는 값(멤버 수, 회의 수, 내 권한)만 회색. [멤버]는 받기 전에는 비활성 */}
        <div className={styles.metaLine}>
          <button type="button" className={styles.linkButton} disabled>
            멤버 <Skeleton width={SKELETON.countWidth} height={SKELETON.countHeight} className={styles.inlineSkeleton} />명
          </button>
          <span className={styles.metaDivider} aria-hidden="true" />
          <span className={styles.metaText}>
            회의 <Skeleton width={SKELETON.countWidth} height={SKELETON.countHeight} className={styles.inlineSkeleton} />개
          </span>
          <span className={styles.metaDivider} aria-hidden="true" />
          <span className={styles.metaText}>내 권한</span>
          <Skeleton width={SKELETON.badgeWidth} height={SKELETON.badgeHeight} />
        </div>
        {/* 안건 결정률, 남은 안건, 예정 시간 초과는 회색 자리 대신 데이터가 없을 때의 화면을 먼저 그리고 받으면 채운다 */}
        <FolderStats stats={[]} pendingAgendas={[]} onDiscardPending={() => undefined} />
        {/* key가 다 불러온 화면의 회의 목록 묶음과 같아, 폴더를 받은 뒤에도 달력이 새로 만들어지지 않는다 (점 깜빡임, 중복 요청 없이) */}
        <section key="meetings" className={styles.meetingSection} aria-labelledby="meetings-title">
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitleGroup}>
              <h2 id="meetings-title" className={styles.sectionTitle}>
                회의 목록
              </h2>
            </div>
            {/* 워크스페이스를 받기 전이라 아카이브 주소를 몰라 비활성 */}
            <button type="button" className={styles.textButton} disabled>
              회의록 아카이브
            </button>
          </div>
          <div className={styles.calendarAndList}>
            {/* 달력은 폴더 id(주소)로 회의 점을 스스로 받는다. 폴더 색은 아는 대로, 모르면 기본 색 */}
            <FolderCalendar folderId={id} color={folderColor(known?.color)} selectedDay={selectedDay} onSelectDay={selectDay} />
            <div className={styles.tableCard}>
              <MeetingTable
                meetings={[]}
                onOpen={() => undefined}
                sort={sort}
                onSortChange={(next) => changeView({ sort: next })}
                page={page}
                onPageChange={() => undefined}
                rowMenu={() => []}
                empty={meetingEmpty(selectedDay, () => navigate(`/folders/${folderId}/meetings/new`))}
              />
            </div>
          </div>
        </section>
        {/* 새 회의 창 (하위 라우트 meetings/new) */}
        <Outlet />
      </>
    );
  }

  return (
    <>
      {toast && <Toast message={toast} onClose={closeToast} />}

      <div className={styles.head}>
        <nav className={styles.breadcrumb} aria-label="현재 위치">
          <button type="button" className={styles.crumb} onClick={() => navigate(`/workspaces/${folder.workspaceId}`)}>
            워크스페이스
          </button>
          <Icon src={separatorIcon} size={SEPARATOR_ICON_SIZE} className={styles.separator} />
          <span aria-current="page" className={styles.current}>
            {folder.name}
          </span>
        </nav>
        <div className={styles.titleRow}>
          <div className={styles.titleGroup}>
            {/* REQ-202 피그마 Page 8 ProjectColorIcon */}
            <span
              className={styles.colorIcon}
              style={{ background: folderSubtleColor(folder.color), color: folderIconColor(folder.color) }}
              aria-hidden="true"
            >
              <Icon src={folderIcon} size={BUTTON_ICON_SIZE} />
            </span>
            <h1 className={styles.title}>{folder.name}</h1>
          </div>
          <div className={styles.titleActions}>
            {/* REQ-050 폴더 멤버 모두 새 회의를 만들 수 있다 */}
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => navigate(`/folders/${folder.folderId}/meetings/new`)}
            >
              <Icon src={addIcon} size={BUTTON_ICON_SIZE} />새 회의
            </button>
            {/* REQ-165 폴더 ⋮ 메뉴 (피그마 11/24 코멘트: [새 회의] 오른쪽으로 옮김). 보일 항목이 없으면(기본 폴더의 일반 멤버) 숨긴다 */}
            {(canEditSettings || !folder.isDefault) && (
              <span className={styles.menuAnchor}>
                <button
                  ref={folderMenuRef}
                  type="button"
                  className={styles.iconButton}
                  aria-label="폴더 메뉴"
                  aria-haspopup="menu"
                  aria-expanded={isFolderMenuOpen}
                  onClick={() => setIsFolderMenuOpen((value) => !value)}
                >
                  <Icon src={moreIcon} size={MORE_ICON_SIZE} />
                </button>
                {isFolderMenuOpen && (
                  <ActionMenu
                    label="폴더 메뉴"
                    anchorRef={folderMenuRef}
                    onClose={() => setIsFolderMenuOpen(false)}
                    // 피그마 04 프로젝트 "프로젝트 ⋮ 더보기" (11/24 코멘트 #30): 멤버 관리는 빼고 설정, 나가기, 삭제 (워크스페이스와 같게)
                    items={[
                      // REQ-165, 202 프로젝트 설정 (이름, 색, 소유권): 프로젝트 소유자, 워크스페이스 소유자
                      ...(canEditSettings
                        ? [{ label: '프로젝트 설정', icon: settingsIcon, onSelect: () => setDialog({ type: 'settings' }) }]
                        : []),
                      // 폴더 나가기는 모두에게 보인다. 소유자는 누르면 소유권 양도 안내 (MSG-045, MSG-101)
                      ...(!folder.isDefault
                        ? [{ label: '폴더 나가기', icon: logoutIcon, onSelect: () => setDialog({ type: 'leave' }) }]
                        : []),
                      // REQ-058 폴더 삭제: 기본 폴더는 지울 수 없다
                      ...(!folder.isDefault && canEditSettings
                        ? [
                            {
                              label: '폴더 삭제',
                              icon: deleteIcon,
                              isDanger: true,
                              hasDividerBefore: true,
                              onSelect: () => setDialog({ type: 'deleteFolder' }),
                            },
                          ]
                        : []),
                    ].map((item) => ({
                      ...item,
                      onSelect: () => {
                        setIsFolderMenuOpen(false);
                        item.onSelect();
                      },
                    }))}
                  />
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 피그마 Page 8 MetaLine: 멤버 수(REQ-203), 회의 수, 내 권한 */}
      <div className={styles.metaLine}>
        {/* 피그마 11/24: [멤버 N명]이 멤버 관리 창을 연다 (추가, 제외는 관리할 수 있는 사람만, 아니면 보기 전용) */}
        <button type="button" className={styles.linkButton} aria-haspopup="dialog" onClick={() => void openMembers()}>
          멤버 {members.length}명
        </button>
        <span className={styles.metaDivider} aria-hidden="true" />
        <span className={styles.metaText}>회의 {meetings.length}개</span>
        <span className={styles.metaDivider} aria-hidden="true" />
        <span className={styles.metaText}>내 권한</span>
        <span className={styles.roleBadge}>{folder.isOwner ? '소유자' : isWorkspaceOwner ? '워크스페이스 소유자' : '멤버'}</span>
      </div>

      <FolderStats stats={stats} pendingAgendas={pendingAgendas} onDiscardPending={(agenda) => void discardPending(agenda)} />

      <section key="meetings" className={styles.meetingSection} aria-labelledby="meetings-title">
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitleGroup}>
            <h2 id="meetings-title" className={styles.sectionTitle}>
              회의 목록
            </h2>
            {/* 날짜를 골랐다는 뱃지는 뺐다. 고른 날은 달력에 표시되고, 같은 날을 다시 누르면 풀린다 (SCRUM-410) */}
          </div>
          {/* REQ-053 회의 목록 오른쪽 위 [회의록 아카이브]. 이 폴더 탭을 고른 채로 연다 (QA 2026-11-23) */}
          <button
            type="button"
            className={styles.textButton}
            onClick={() => navigate(`/workspaces/${folder.workspaceId}/archive?folder=${folder.folderId}`)}
          >
            회의록 아카이브
          </button>
        </div>
        <div className={styles.calendarAndList}>
          {/* REQ-201 */}
          <FolderCalendar
            folderId={folder.folderId}
            color={folderColor(folder.color)}
            selectedDay={selectedDay}
            onSelectDay={selectDay}
          />
          <div className={styles.tableCard}>
            <MeetingTable
              meetings={shownMeetings}
              onOpen={(meeting) => navigate(meetingPath(meeting))}
              sort={sort}
              onSortChange={(next) => changeView({ sort: next })}
              page={page}
              onPageChange={(next) => changeView({ page: next })}
              rowMenu={meetingMenu}
              empty={meetingEmpty(selectedDay, () => navigate(`/folders/${folder.folderId}/meetings/new`))}
            />
          </div>
        </div>
      </section>

      {dialog?.type === 'members' && (
        <FolderMembersModal
          members={members}
          workspaceMembers={workspaceMembers}
          workspaceMembersError={workspaceMembersError}
          canManage={canManageMembers}
          onAdd={addMembers}
          onRemove={removeMembers}
          onNotice={notice}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'settings' && (
        <ProjectSettingsModal
          name={folder.name}
          color={folder.color}
          // 피그마 11/24 코멘트(2026-11-25 사용자 결정): 이름도 색, 삭제처럼 프로젝트 소유자와 워크스페이스 소유자. 기본 폴더는 워크스페이스 소유자
          canRename={folder.isDefault ? isWorkspaceOwner : canEditSettings}
          canTransfer={folder.isOwner}
          onSave={saveSettings}
          onTransfer={() => setDialog({ type: 'transfer' })}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'transfer' && (
        // REQ-043 MSG-090, 091 (피그마: 프로젝트 설정 [소유권 양도] 또는 나가기 제한 창 [소유권 양도] → 이 창)
        <TransferOwnerDialog
          candidates={members.filter((member) => !member.isOwner)}
          onTransfer={transferOwnership}
          confirmDescription={(name) => `넘기면 프로젝트 관리 권한은 ${name} 님에게 가요. 나는 일반 멤버가 돼요`}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'deleteFolder' && (
        // MSG-046 (워크스페이스 폴더 카드의 삭제 확인과 같은 문구)
        <ConfirmDialog
          title={`${folder.name} 폴더를 삭제할까요?`}
          message={`폴더 안의 회의 ${meetings.length}개와 회의록이 함께 삭제돼요. 3개월 동안 삭제 목록에서 복구할 수 있어요`}
          cancelLabel="취소"
          confirmLabel="삭제하기"
          isDanger
          onCancel={closeDialog}
          onConfirm={() => void removeFolder()}
        />
      )}
      {dialog?.type === 'leave' &&
        (isWorkspaceOwner && !folder.isOwner ? (
          // MSG-101 워크스페이스 소유자는 모든 폴더를 함께 관리하므로 워크스페이스 소유권을 넘겨야 나갈 수 있다
          <ConfirmDialog
            title="워크스페이스 소유권을 넘겨야 폴더에서 나갈 수 있어요"
            message="워크스페이스 소유자는 모든 폴더를 함께 관리해요. 다른 멤버에게 워크스페이스 소유권을 넘긴 뒤 다시 시도해 주세요"
            cancelLabel="취소"
            confirmLabel="소유권 양도"
            onCancel={closeDialog}
            onConfirm={() => navigate(`/workspaces/${folder.workspaceId}`, { state: { openMembers: true } })}
          />
        ) : folder.isOwner ? (
          // MSG-045
          <ConfirmDialog
            title="소유권을 넘겨야 폴더에서 나갈 수 있어요"
            message="다른 폴더 멤버에게 소유권을 넘긴 뒤 다시 시도해 주세요"
            cancelLabel="취소"
            confirmLabel="소유권 양도"
            onCancel={closeDialog}
            onConfirm={() => setDialog({ type: 'transfer' })}
          />
        ) : (
          // MSG-044
          <ConfirmDialog
            title={`${folder.name} 폴더에서 나갈까요?`}
            message="나가면 이 폴더의 회의와 회의록을 볼 수 없어요"
            cancelLabel="취소"
            confirmLabel="나가기"
            onCancel={closeDialog}
            onConfirm={leave}
          />
        ))}
      {/* 새 회의 창 (하위 라우트 meetings/new) */}
      <Outlet />
    </>
  );
}
