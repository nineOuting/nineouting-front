import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import {
  ARCHIVE_PAGE_SIZE,
  downloadMinutes,
  listArchiveFolderCounts,
  listMinutesLocations,
  listViewedMinutes,
  listWorkspaceMinutes,
  type ArchiveMinutes,
  type ArchiveQuery,
  type ExportFormat,
  type ViewedMinutes,
} from '../../api/minutes';
import {
  getWorkspace,
  listFolders,
  listMyWorkspaces,
  listWorkspaceMembers,
  type WorkspaceDetail,
} from '../../api/workspace';
import { getMe } from '../../api/user';
import { useAppShell } from '../../components/useAppShell';
import ConfirmDialog from '../../components/ConfirmDialog';
import DropdownMenu from '../../components/DropdownMenu';
import chevronIcon from '../../assets/icons/chevron-up-sm.svg';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import chevronRightIcon from '../../assets/icons/chevron-right.svg';
import searchIcon from '../../assets/icons/search.svg';
import Icon from '../../components/Icon';
import { restoreMeeting, trashMeeting } from '../../api/meeting';
import copyIcon from '../../assets/icons/copy.svg';
import deleteIcon from '../../assets/icons/delete-sm.svg';
import downloadIcon from '../../assets/icons/download-sm.svg';
import emptyCharacter from '../../assets/characters/empty.svg';
import failCharacter from '../../assets/characters/fail.svg';
import unknownCharacter from '../../assets/characters/unknown.svg';
import EmptyState from '../../components/EmptyState';
import Skeleton from '../../components/Skeleton';
import { peekWorkspaceName } from '../../components/sidebarCache';
import CreateWorkspaceModal from '../workspace/CreateWorkspaceModal';
import Popover from '../../components/Popover';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { FolderSummary, WorkspaceMember, WorkspaceSummary } from '../../types/workspace';
import { toIsoDate } from '../../utils/calendar';
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher';
import ArchiveTable from './ArchiveTable';
import CheckListFilter from './CheckListFilter';
import PeriodPicker, { type Period } from './PeriodPicker';
import type { BackState } from '../../utils/meetingFormat';
import styles from './ArchivePage.module.css';

const ICON_SIZE = 16;
const SEARCH_ICON_SIZE = 20;
const SORT_ICON_SIZE = 16;
const PAGER_ICON_SIZE = 16;
// REQ-159 최근 본 회의록 최대 2건
const VIEWED_SIZE = 2;
// 페이지 번호를 모두 보여 주는 최대 페이지 수 (넘으면 … 으로 줄인다)
const PAGER_FULL = 7;
// REQ-167 최신순(기본), 오래된순, 회의명순
const SORT_LABELS = { LATEST: '최신순', OLDEST: '오래된순', TITLE: '회의명순' } as const;

type FilterKey = 'period' | 'location' | 'attendee';

interface Filters {
  period: Period | null;
  locations: string[];
  attendeeIds: number[];
}

const LOADING_ROWS = 4;
// 주소에 여러 값을 담을 때 나누는 글자 (장소 이름에는 잘 쓰지 않는다)
const LIST_SEPARATOR = '|';

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

/** 주소의 from, to, locations, attendees를 필터로 읽는다 */
function filtersOf(params: URLSearchParams): Filters {
  const from = params.get('from');
  const to = params.get('to');
  const locations = params.get('locations');
  const attendees = params.get('attendees');
  return {
    period: from && to ? { from, to } : null,
    locations: locations ? locations.split(LIST_SEPARATOR) : [],
    attendeeIds: attendees ? attendees.split(LIST_SEPARATOR).map(Number).filter(Number.isFinite) : [],
  };
}

type FolderTab = Omit<FolderSummary, 'meetingCount'> & { minutesCount: number };

/**
 * 불러오는 동안 회색 자리: "전체" 탭은 진짜로(회의록 수만 회색), 그 뒤 폴더 탭 2개, 제목(워크스페이스 이름) 줄 높이 32.
 * 폴더 탭은 들어갈 수 있는 폴더만 나와서 사이드 바가 아는 폴더 목록과 다를 수 있어 회색으로 둔다
 */
const SKELETON_FOLDER_TABS = 2;
const SKELETON_TAB_WIDTH = 72;
const SKELETON_TAB_HEIGHT = 20;
const SKELETON_COUNT_WIDTH = 24;
const SKELETON_COUNT_HEIGHT = 16;
const SKELETON_TITLE_WIDTH = 200;
const SKELETON_TITLE_HEIGHT = 32;

/** 1 2 3 4 … 8 처럼 지금 페이지 주변과 처음, 끝만 (0부터 센 페이지, null은 …) */
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= PAGER_FULL) {
    return Array.from({ length: total }, (_, index) => index);
  }
  const start = Math.max(1, Math.min(current - 1, total - 5));
  const end = Math.min(total - 2, Math.max(current + 1, 4));
  const middle = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return [0, ...(start > 1 ? [null] : []), ...middle, ...(end < total - 2 ? [null] : []), total - 1];
}

/** 2026-10-20T11:20:00 → 오늘 11:20, 어제 16:05, 10.18 09:00 */
function viewedLabel(viewedAt: string) {
  const day = viewedAt.slice(0, 10);
  const time = viewedAt.slice(11, 16);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day === toIsoDate(today)) {
    return `오늘 ${time}`;
  }
  if (day === toIsoDate(yesterday)) {
    return `어제 ${time}`;
  }
  return `${day.slice(5, 7)}.${day.slice(8, 10)} ${time}`;
}

const EMPTY_FILTERS: Filters = { period: null, locations: [], attendeeIds: [] };

interface FilterChipProps {
  label: string;
  isApplied: boolean;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** 디자인 Page 9 ArchiveSearchResultPage: 적용되면 옅은 파란 칩에 고른 값. 하나씩 지우기는 아래 칩 줄에서 */
function FilterChip({ label, isApplied, isOpen, onToggle, children }: FilterChipProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={anchorRef} className={styles.chipAnchor}>
      <button
        type="button"
        className={[styles.chip, isApplied ? styles.chipApplied : ''].filter(Boolean).join(' ')}
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className={styles.chipLabel}>{label}</span>
        <Icon src={chevronIcon} size={ICON_SIZE} className={isOpen ? undefined : styles.flipped} />
      </button>
      {isOpen && (
        <Popover label={`${label} 필터`} anchorRef={anchorRef} onClose={onToggle}>
          {children}
        </Popover>
      )}
    </div>
  );
}

/**
 * REQ-053~055, 029~030, 159~160, 167~168 회의록 아카이브 (디자인 Page 9 10 회의록 아카이브).
 * 워크스페이스에서 내가 들어갈 수 있는 폴더의 회의록을 폴더 탭, 검색, 필터로 찾는다
 */
export default function ArchivePage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const id = Number(workspaceId);
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  // 폴더 탭과 회의록 수. 어느 워크스페이스 것인지 같이 둬서, 받기 전(다른 워크스페이스 것)에는 회색 자리를 그린다
  // (받기 전에 "전체 0"을 그리면 받은 뒤 개수와 탭이 바뀌는 게 보인다)
  const [folderTabs, setFolderTabs] = useState<{ workspaceId: number; tabs: FolderTab[] } | null>(null);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [viewed, setViewed] = useState<ViewedMinutes[]>([]);
  const [isViewedOpen, setIsViewedOpen] = useState(false);
  const [keyword, setKeyword] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  // REQ-160 [회의록 삭제] 확인 창 (MSG-116)
  const [deleting, setDeleting] = useState<ArchiveMinutes | null>(null);
  // 되돌리기, 이동, 다시 시도 뒤 같은 조건으로 다시 받는다
  const [reloadToken, setReloadToken] = useState(0);
  const [items, setItems] = useState<ArchiveMinutes[]>([]);
  // 마지막으로 받은 요청. 지금 조건과 다르면 불러오는 중이다
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [isFailed, setIsFailed] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  // REQ-031 워크스페이스 바꾸기 메뉴의 [새 워크스페이스 만들기]
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const switcherRef = useRef<HTMLButtonElement>(null);
  const sortRef = useRef<HTMLButtonElement>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeSwitcher = useCallback(() => setIsSwitcherOpen(false), []);
  const closeSort = useCallback(() => setIsSortOpen(false), []);
  const showError = useCallback((error: unknown) => setToast({ text: errorMessage(error), variant: 'error' }), []);
  // REQ-180 검색어, 필터, 정렬, 폴더 탭, 쪽 번호는 주소에 둬서 회의록을 보고 뒤로 와도 그대로다
  const [searchParams, setSearchParams] = useSearchParams();
  const paramsKey = searchParams.toString();
  const query = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort');
  const sort: ArchiveQuery['sort'] = sortParam === 'OLDEST' || sortParam === 'TITLE' ? sortParam : 'LATEST';
  const folderParam = Number(searchParams.get('folder'));
  const folderId = Number.isInteger(folderParam) && folderParam > 0 ? folderParam : undefined;
  // 주소의 page는 1부터 (첫 쪽이면 뺀다). 안에서는 0부터 센다 (SCRUM-366)
  const pageParam = Number(searchParams.get('page'));
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam - 1 : 0;
  const filters = useMemo(() => filtersOf(new URLSearchParams(paramsKey)), [paramsKey]);
  const updateParams = (patch: { q?: string; sort?: ArchiveQuery['sort']; filters?: Filters; folderId?: number | null }) => {
    const next = new URLSearchParams(searchParams);
    if (patch.q !== undefined) {
      setOrDelete(next, 'q', patch.q);
    }
    if (patch.sort !== undefined) {
      setOrDelete(next, 'sort', patch.sort === 'LATEST' ? '' : patch.sort);
    }
    if (patch.filters) {
      setOrDelete(next, 'from', patch.filters.period?.from ?? '');
      setOrDelete(next, 'to', patch.filters.period?.to ?? '');
      setOrDelete(next, 'locations', patch.filters.locations.join(LIST_SEPARATOR));
      setOrDelete(next, 'attendees', patch.filters.attendeeIds.join(LIST_SEPARATOR));
    }
    if (patch.folderId !== undefined) {
      setOrDelete(next, 'folder', patch.folderId === null ? '' : String(patch.folderId));
    }
    // 검색 조건이 바뀌면 첫 쪽부터
    next.delete('page');
    setSearchParams(next, { replace: true });
  };
  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    setOrDelete(next, 'page', nextPage > 0 ? String(nextPage + 1) : '');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let isCurrent = true;
    Promise.all([getWorkspace(id), listMyWorkspaces(), listWorkspaceMembers(id), listMinutesLocations(id)])
      .then(([detail, mine, people, places]) => {
        if (isCurrent) {
          setWorkspace(detail);
          setWorkspaces(mine);
          setMembers(people);
          setLocations(places);
        }
      })
      .catch(showError);
    listViewedMinutes(id, VIEWED_SIZE)
      .then((loaded) => isCurrent && setViewed(loaded))
      .catch(() => undefined);
    getMe()
      .then((me) => isCurrent && setMyUserId(me.userId))
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [id, showError]);

  // 폴더 탭: 폴더 순서와 색은 폴더 목록에서, 회의록 수는 아카이브에서 (삭제, 이동 뒤 다시 센다)
  useEffect(() => {
    let isCurrent = true;
    Promise.all([listFolders(id), listArchiveFolderCounts(id)])
      .then(([folders, counts]) => {
        if (isCurrent) {
          const countOf = new Map(counts.map((count) => [count.folderId, count.minutesCount]));
          setFolderTabs({
            workspaceId: id,
            tabs: folders
              .filter((folder) => countOf.has(folder.folderId))
              .map((folder) => ({ ...folder, minutesCount: countOf.get(folder.folderId) ?? 0 })),
          });
        }
      })
      .catch(() => isCurrent && setFolderTabs({ workspaceId: id, tabs: [] }));
    return () => {
      isCurrent = false;
    };
  }, [id, reloadToken]);

  const requestKey = JSON.stringify([id, query, filters, sort, folderId, page, reloadToken]);
  // 스켈레톤은 처음 들어올 때(또는 워크스페이스를 바꿨을 때)만. 검색 조건이 바뀌면 이전 목록을 흐리게 두고
  // 결과가 오면 그 자리에서 바꾼다. 스켈레톤이 잠깐 나왔다 사라지며 번쩍이지 않게 (SCRUM-410)
  const isFirstLoad = loadedKey === null || (JSON.parse(loadedKey) as unknown[])[0] !== id;
  const isRefreshing = !isFirstLoad && loadedKey !== requestKey;

  useEffect(() => {
    let isCurrent = true;
    const archiveQuery: ArchiveQuery = {
      q: query,
      from: filters.period?.from,
      to: filters.period?.to,
      locations: filters.locations,
      attendeeIds: filters.attendeeIds,
      sort,
      folderId,
    };
    listWorkspaceMinutes(id, archiveQuery, page)
      .then((result) => {
        if (isCurrent) {
          setLoadedKey(requestKey);
          setIsFailed(false);
          setItems(result.items);
          setTotalCount(result.totalCount);
        }
      })
      .catch(() => {
        if (isCurrent) {
          // 디자인 목록 불러오기 실패 (MSG-114)
          setLoadedKey(requestKey);
          setIsFailed(true);
          setItems([]);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [id, query, filters, sort, folderId, page, requestKey]);

  const changeFilters = (next: Filters) => {
    updateParams({ filters: next });
    setOpenFilter(null);
  };
  const resetAll = () => {
    setKeyword('');
    updateParams({ q: '', filters: EMPTY_FILTERS });
    setOpenFilter(null);
  };
  // REQ-054 검색창에서 Enter로 검색 (디자인에 [검색] 버튼 없음)
  const search = (event: FormEvent) => {
    event.preventDefault();
    setIsViewedOpen(false);
    updateParams({ q: keyword });
  };
  const toggleFilter = (key: FilterKey) => setOpenFilter((open) => (open === key ? null : key));
  // REQ-175 아카이브에서 열어도 회의록 확인 화면 (끝난 회의의 대기 화면)
  const location = useLocation();
  // 회의록 확인에서 뒤로 가면 지금 보던 탭, 검색어, 필터, 쪽 그대로 아카이브로 돌아온다 (SCRUM-366)
  const openMinutes = (meetingId: number) =>
    navigate(`/meetings/${meetingId}`, { state: { backTo: `${location.pathname}${location.search}` } satisfies BackState });
  // 피그마 프론트 "다운로드 메뉴": 형식을 고르면 그 자리에서 받는다. 실패하면 MSG-040
  const download = async (item: ArchiveMinutes, format: ExportFormat) => {
    try {
      await downloadMinutes(item.minutesId, format);
    } catch {
      setToast({ text: '파일을 다운로드하지 못했어요. 잠시 후 다시 시도해 주세요.', variant: 'error' });
    }
  };
  const reload = () => setReloadToken((value) => value + 1);

  // REQ-160 링크 복사 (MSG-064)
  const copyLink = async (item: ArchiveMinutes) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meetings/${item.meetingId}`);
      setToast({ text: '링크를 복사했어요.', variant: 'success' });
    } catch {
      setToast({ text: '링크를 복사하지 못했어요. 다시 시도해 주세요.', variant: 'error' });
    }
  };

  // REQ-160 회의록 삭제: 회의와 함께 삭제 목록으로 (REQ-143). [되돌리기] 5초
  const removeMinutes = async (item: ArchiveMinutes) => {
    try {
      await trashMeeting(item.meetingId);
      reload();
      setToast({
        // 디자인 10 상태 모음 11/25 변경: 회의도 같이 지워졌다고 알린다. 체크 아이콘
        text: `'${item.title}' 회의와 회의록을 삭제했어요.`,
        variant: 'success',
        action: {
          label: '되돌리기',
          onClick: () => {
            restoreMeeting(item.meetingId).then(reload).catch(showError);
          },
        },
      });
    } catch (error) {
      showError(error);
    }
  };

  const memberName = (userId: number) => members.find((member) => member.userId === userId)?.name ?? '알 수 없는 사용자';
  // 디자인 10 PeriodFilter: 2026.10.10 ~ 10.26 (끝 날짜의 해가 다르면 해까지) (SCRUM-366)
  const periodText = (period: Period) => {
    const from = period.from.replaceAll('-', '.');
    const to = period.to.replaceAll('-', '.');
    if (period.from === period.to) {
      return from;
    }
    return `${from} ~ ${period.from.slice(0, 4) === period.to.slice(0, 4) ? to.slice(5) : to}`;
  };
  const hasFilters = Boolean(filters.period || filters.locations.length || filters.attendeeIds.length);
  const loadedTabs = folderTabs?.workspaceId === id ? folderTabs.tabs : null;
  const folderColors = new Map((loadedTabs ?? []).map((folder) => [folder.folderId, folder.color]));
  // REQ-160 [회의록 삭제]는 폴더 소유자만 본다 (소유자가 없는 기본 폴더는 워크스페이스 소유자)
  const isFolderOwner = (folderId: number) => {
    const folder = loadedTabs?.find((tab) => tab.folderId === folderId);
    if (!folder) {
      return false;
    }
    return folder.isDefault ? Boolean(workspace?.isOwner) : myUserId !== null && folder.ownerUserId === myUserId;
  };
  const pageCount = Math.max(1, Math.ceil(totalCount / ARCHIVE_PAGE_SIZE));
  const tabs: { id: number | null; name: string; count: number }[] = [
    { id: null, name: '전체', count: (loadedTabs ?? []).reduce((sum, folder) => sum + folder.minutesCount, 0) },
    ...(loadedTabs ?? []).map((folder) => ({ id: folder.folderId, name: folder.name, count: folder.minutesCount })),
  ];

  useAppShell({ className: styles.page, workspaceId: id });

  return (
    <>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <p className={styles.breadcrumb}>회의록 아카이브</p>
      <div className={styles.titleBlock}>
        {/* REQ-029~030 워크스페이스 이름 옆 드롭다운으로 바꾼다 */}
        <h1 className={`${styles.anchor} ${styles.title}`}>
          <button
            ref={switcherRef}
            type="button"
            className={styles.workspaceButton}
            aria-haspopup="menu"
            aria-expanded={isSwitcherOpen}
            onClick={() => setIsSwitcherOpen((open) => !open)}
          >
            {/* 앱 안에서 옮겨 왔으면 사이드 바가 받아 둔 이름을 바로 그린다. 새로고침·주소로 바로 왔으면 몰라서 회색
                (회색도 제목과 같은 높이라 아이콘만 남아 줄이 낮아지지 않는다) */}
            {workspace?.name ?? peekWorkspaceName(id) ?? <Skeleton width={SKELETON_TITLE_WIDTH} height={SKELETON_TITLE_HEIGHT} />}
            <Icon src={chevronIcon} size={SEARCH_ICON_SIZE} className={isSwitcherOpen ? styles.mutedIcon : `${styles.mutedIcon} ${styles.flipped}`} />
          </button>
          {isSwitcherOpen && (
            <WorkspaceSwitcher
              workspaces={workspaces}
              currentId={id}
              anchorRef={switcherRef}
              onSelect={(selectedId) => {
                closeSwitcher();
                setKeyword('');
                navigate(`/workspaces/${selectedId}/archive`);
              }}
              onCreate={() => {
                closeSwitcher();
                setIsCreatingWorkspace(true);
              }}
              onClose={closeSwitcher}
            />
          )}
        </h1>
        <p className={styles.description}>지난 회의록을 찾아보고, 내려받거나 관리할 수 있어요.</p>
      </div>

      <section className={styles.card} aria-label="회의록 목록">
        {/* 폴더 탭: 전체와 내가 들어갈 수 있는 폴더, 회의록 수 */}
        <div className={styles.tabs} role="tablist" aria-label="폴더">
          {!loadedTabs && (
            <>
              <button
                type="button"
                role="tab"
                aria-selected={folderId === undefined}
                className={[styles.tab, folderId === undefined ? styles.tabSelected : ''].filter(Boolean).join(' ')}
                onClick={() => updateParams({ folderId: null })}
              >
                전체
                <Skeleton width={SKELETON_COUNT_WIDTH} height={SKELETON_COUNT_HEIGHT} />
              </button>
              {Array.from({ length: SKELETON_FOLDER_TABS }, (_, index) => (
                <span key={index} className={styles.tab} aria-hidden="true">
                  <Skeleton width={SKELETON_TAB_WIDTH} height={SKELETON_TAB_HEIGHT} />
                </span>
              ))}
            </>
          )}
          {loadedTabs && tabs.map((tab) => {
            const isSelected = (tab.id ?? undefined) === folderId;
            return (
              <button
                key={tab.id ?? 'all'}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={[styles.tab, isSelected ? styles.tabSelected : ''].filter(Boolean).join(' ')}
                onClick={() => updateParams({ folderId: tab.id })}
              >
                {tab.name}
                <span className={styles.tabCount}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchAnchor}>
            <form className={styles.searchField} role="search" onSubmit={search}>
              <Icon src={searchIcon} size={SEARCH_ICON_SIZE} className={styles.mutedIcon} />
              <input
                className={styles.searchInput}
                aria-label="회의명, 내용으로 검색"
                placeholder="회의명, 내용으로 검색"
                value={keyword}
                onFocus={() => setIsViewedOpen(true)}
                onBlur={() => setIsViewedOpen(false)}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </form>
            {/* REQ-159 검색창을 누르면 최근 본 회의록 2건이 바로 아래로 열린다 */}
            {isViewedOpen && !keyword && viewed.length > 0 && (
              <div className={styles.viewedMenu} aria-label="최근 본 회의록">
                <p className={styles.viewedTitle}>최근 본 회의록</p>
                {viewed.map((item) => (
                  <button
                    key={item.minutesId}
                    type="button"
                    className={styles.viewedItem}
                    // 검색창의 blur보다 먼저 눌리게
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openMinutes(item.meetingId)}
                  >
                    <span className={styles.viewedName}>{item.title}</span>
                    <span className={styles.viewedMeta}>
                      {item.folderName} · {viewedLabel(item.viewedAt)}에 봤어요
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <FilterChip
            label={filters.period ? periodText(filters.period) : '전체 기간'}
            isApplied={Boolean(filters.period)}
            isOpen={openFilter === 'period'}
            onToggle={() => toggleFilter('period')}
          >
            <PeriodPicker
              value={filters.period}
              onApply={(period) => changeFilters({ ...filters, period })}
              onCancel={() => setOpenFilter(null)}
            />
          </FilterChip>
          <FilterChip
            label={filters.locations.length ? filters.locations.join(', ') : '전체 장소'}
            isApplied={filters.locations.length > 0}
            isOpen={openFilter === 'location'}
            onToggle={() => toggleFilter('location')}
          >
            <CheckListFilter
              options={locations.map((location) => ({ id: location, label: location }))}
              selected={filters.locations}
              searchPlaceholder="장소 검색"
              emptyText="회의록에 적힌 장소가 없어요"
              onApply={(ids) => changeFilters({ ...filters, locations: ids })}
              onCancel={() => setOpenFilter(null)}
            />
          </FilterChip>
          <FilterChip
            label={filters.attendeeIds.length ? filters.attendeeIds.map(memberName).join(', ') : '전체 참석자'}
            isApplied={filters.attendeeIds.length > 0}
            isOpen={openFilter === 'attendee'}
            onToggle={() => toggleFilter('attendee')}
          >
            <CheckListFilter
              options={members.map((member) => ({ id: String(member.userId), label: member.name, member }))}
              selected={filters.attendeeIds.map(String)}
              searchPlaceholder="참석자 검색"
              emptyText="찾는 멤버가 없어요"
              withSelectAll
              onApply={(ids) => changeFilters({ ...filters, attendeeIds: ids.map(Number) })}
              onCancel={() => setOpenFilter(null)}
            />
          </FilterChip>
          {hasFilters && (
            <button type="button" className={styles.reset} onClick={() => changeFilters(EMPTY_FILTERS)}>
              필터 초기화
            </button>
          )}
          {/* REQ-167 정렬 */}
          <span className={`${styles.anchor} ${styles.sortAnchor}`}>
            <button
              ref={sortRef}
              type="button"
              className={styles.sort}
              aria-haspopup="listbox"
              aria-expanded={isSortOpen}
              onClick={() => setIsSortOpen((open) => !open)}
            >
              {SORT_LABELS[sort]}
              <Icon src={chevronIcon} size={SORT_ICON_SIZE} className={isSortOpen ? undefined : styles.flipped} />
            </button>
            {isSortOpen && (
              <DropdownMenu
                label="정렬"
                emptyText=""
                anchorRef={sortRef}
                className={styles.sortMenu}
                showCheck
                items={(['LATEST', 'OLDEST', 'TITLE'] as const).map((option) => ({
                  id: option,
                  label: SORT_LABELS[option],
                  isSelected: sort === option,
                }))}
                onSelect={(option) => {
                  updateParams({ sort: option as ArchiveQuery['sort'] });
                  closeSort();
                }}
                onClose={closeSort}
              />
            )}
          </span>
        </div>

        {/* 적용된 조건 칩 줄은 뺐다 (디자인 체크 2026-11-19). 필터 버튼에 고른 값이 보이고 [필터 초기화]로 지운다 */}
        {isFirstLoad ? (
          // 처음 불러오는 동안에도 표 머리 줄(칼럼 이름)은 진짜로, 그 아래 줄만 회색
          <div aria-busy="true">
            <ArchiveTable
              items={[]}
              folderColors={folderColors}
              onOpen={() => undefined}
              onDownload={() => undefined}
              rowMenu={() => []}
              loadingRows={LOADING_ROWS}
            />
          </div>
        ) : (
          <div className={isRefreshing ? styles.refreshing : undefined} aria-busy={isRefreshing}>
            {/* 디자인 10 상태 모음: 비었거나 못 불러와도 표 머리 줄은 그대로 두고 그 아래 상황별 캐릭터 (SCRUM-366) */}
            <ArchiveTable
              items={isFailed ? [] : items}
              folderColors={folderColors}
              onOpen={(item) => openMinutes(item.meetingId)}
              onDownload={(item, format) => void download(item, format)}
              rowMenu={(item, openDownload) => [
                // 디자인 10 줄 메뉴: 다운로드, 링크 복사, (구분선) 회의록 삭제. 회의록 보기는 줄을 누르면 되므로 뺐다 (SCRUM-366)
                { label: '다운로드', icon: downloadIcon, onSelect: openDownload },
                { label: '링크 복사', icon: copyIcon, onSelect: () => void copyLink(item) },
                ...(isFolderOwner(item.folderId)
                  ? [{ label: '회의록 삭제', icon: deleteIcon, isDanger: true, hasDividerBefore: true, onSelect: () => setDeleting(item) }]
                  : []),
              ]}
              empty={
                isFailed ? (
                  // MSG-114. 디자인은 버튼이 없지만 다시 불러올 길이 없어 [다시 시도]는 남긴다
                  <EmptyState
                    className={styles.tableEmpty}
                    character={failCharacter}
                    title="회의록 목록을 불러오지 못했어요."
                    description="잠시 후 다시 시도해 주세요."
                    action={
                      <button type="button" className={styles.retry} onClick={reload}>
                        다시 시도
                      </button>
                    }
                  />
                ) : query || hasFilters ? (
                  // MSG-062
                  <EmptyState
                    className={styles.tableEmpty}
                    character={unknownCharacter}
                    title="검색 결과가 없어요"
                    description="다른 검색어를 입력하거나 필터를 줄여 보세요"
                    action={
                      <button type="button" className={styles.reset} onClick={resetAll}>
                        필터 초기화
                      </button>
                    }
                  />
                ) : (
                  // MSG-115
                  <EmptyState className={styles.tableEmpty} character={emptyCharacter} title="아직 회의록이 없어요" description="회의록을 작성 완료하면 여기에 모여요" />
                )
              }
            />

          {/* REQ-168 페이지 번호 (한 페이지 20건) */}
          {!isFailed && items.length > 0 && (
            <div className={styles.footer}>
              <span className={styles.count}>
                {/* 디자인 TableFooter RangeText: 한 쪽이어도 같은 문구 (디자인 체크 2026-11-19) */}
                {`${totalCount}개 중 ${page * ARCHIVE_PAGE_SIZE + 1}–${page * ARCHIVE_PAGE_SIZE + items.length}번째 회의록`}
              </span>
              {pageCount > 1 && (
                <nav className={styles.pager} aria-label="페이지">
                  <button
                    type="button"
                    className={`${styles.pageButton} ${styles.pageArrow}`}
                    aria-label="이전 페이지"
                    disabled={page === 0}
                    onClick={() => goToPage(page - 1)}
                  >
                    <Icon src={chevronLeftIcon} size={PAGER_ICON_SIZE} />
                  </button>
                  {pageNumbers(page, pageCount).map((number, index) =>
                    number === null ? (
                      <span key={`gap-${index}`} className={styles.pageGap}>
                        …
                      </span>
                    ) : (
                      <button
                        key={number}
                        type="button"
                        className={[styles.pageButton, number === page ? styles.pageCurrent : ''].filter(Boolean).join(' ')}
                        aria-current={number === page ? 'page' : undefined}
                        onClick={() => goToPage(number)}
                      >
                        {number + 1}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    className={`${styles.pageButton} ${styles.pageArrow}`}
                    aria-label="다음 페이지"
                    disabled={page >= pageCount - 1}
                    onClick={() => goToPage(page + 1)}
                  >
                    <Icon src={chevronRightIcon} size={PAGER_ICON_SIZE} />
                  </button>
                </nav>
              )}
            </div>
          )}
          </div>
        )}
      </section>
      {isCreatingWorkspace && <CreateWorkspaceModal onClose={() => setIsCreatingWorkspace(false)} />}
      {deleting && (
        <ConfirmDialog
          title={`'${deleting.title}' 회의록을 삭제할까요?`}
          // 디자인 10 상태 모음 11/25 변경: 회의록을 지우면 회의도 같이 지워진다 (REQ-143)
          message="회의록을 삭제하면 이 회의도 함께 삭제돼요. 삭제한 회의와 회의록은 3개월 동안 삭제 목록에서 복구할 수 있어요."
          cancelLabel="취소"
          confirmLabel="삭제하기"
          isDanger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            void removeMinutes(deleting);
            setDeleting(null);
          }}
        />
      )}
    </>
  );
}
