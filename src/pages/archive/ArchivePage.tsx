import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import {
  listMinutesLocations,
  listViewedMinutes,
  listWorkspaceMinutes,
  type ArchiveMinutes,
  type ArchiveQuery,
  type ViewedMinutes,
} from '../../api/minutes';
import { getWorkspace, listMyWorkspaces, listWorkspaceMembers, type WorkspaceDetail } from '../../api/workspace';
import AppLayout from '../../components/AppLayout';
import DropdownMenu from '../../components/DropdownMenu';
import chevronIcon from '../../assets/icons/chevron-up-sm.svg';
import chipRemoveIcon from '../../assets/icons/chip-remove.svg';
import minutesIcon from '../../assets/icons/minutes-doc.svg';
import refreshIcon from '../../assets/icons/refresh.svg';
import searchIcon from '../../assets/icons/search.svg';
import Icon from '../../components/Icon';
import { restoreMeeting, trashMeeting } from '../../api/meeting';
import copyIcon from '../../assets/icons/copy.svg';
import deleteIcon from '../../assets/icons/delete-sm.svg';
import downloadIcon from '../../assets/icons/download-sm.svg';
import moveIcon from '../../assets/icons/folder-sm.svg';
import MoveMeetingModal from '../../components/MoveMeetingModal';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import Skeleton from '../../components/Skeleton';
import CreateWorkspaceModal from '../workspace/CreateWorkspaceModal';
import Popover from '../../components/Popover';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { WorkspaceMember, WorkspaceSummary } from '../../types/workspace';
import { formatPeriodDate } from '../../utils/calendar';
import { formatDateTime } from '../../utils/meetingFormat';
import WorkspaceSwitcher from '../workspace/WorkspaceSwitcher';
import ArchiveTable from './ArchiveTable';
import CheckListFilter from './CheckListFilter';
import PeriodPicker, { type Period } from './PeriodPicker';
import styles from './ArchivePage.module.css';

const ICON_SIZE = 16;
const SEARCH_ICON_SIZE = 20;
const SORT_ICON_SIZE = 16;
const VIEWED_ICON_SIZE = 20;
const VIEWED_SIZE = 5;
const SORT_LABELS = { LATEST: '최신순', OLDEST: '오래된순' } as const;

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
const ROW_HEIGHT = 56;

const EMPTY_FILTERS: Filters = { period: null, locations: [], attendeeIds: [] };

interface FilterChipProps {
  label: string;
  isApplied: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  children: ReactNode;
}

/** 디자인 23:1309(기본)·23:1533(적용됨). 적용되면 파란 칩에 고른 값과 지우기 버튼 */
function FilterChip({ label, isApplied, isOpen, onToggle, onClear, children }: FilterChipProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={anchorRef} className={styles.chipAnchor}>
      <div className={[styles.chip, isApplied ? styles.chipApplied : ''].filter(Boolean).join(' ')}>
        <button type="button" className={styles.chipLabel} aria-expanded={isOpen} onClick={onToggle}>
          {label}
        </button>
        {isApplied ? (
          <button type="button" className={styles.iconButton} aria-label={`${label} 필터 지우기`} onClick={onClear}>
            <Icon src={chipRemoveIcon} size={ICON_SIZE} />
          </button>
        ) : (
          <button type="button" className={styles.iconButton} aria-hidden="true" tabIndex={-1} onClick={onToggle}>
            <Icon src={chevronIcon} size={ICON_SIZE} className={isOpen ? undefined : styles.flipped} />
          </button>
        )}
      </div>
      {isOpen && (
        <Popover label={`${label} 필터`} anchorRef={anchorRef} onClose={onToggle}>
          {children}
        </Popover>
      )}
    </div>
  );
}

/** REQ-053~055, 029~030, 159 회의록 아카이브 (Figma 23-2). 워크스페이스에서 내가 들어갈 수 있는 폴더의 회의록을 모아 본다 */
export default function ArchivePage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const id = Number(workspaceId);
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [viewed, setViewed] = useState<ViewedMinutes[]>([]);
  const [keyword, setKeyword] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [moving, setMoving] = useState<ArchiveMinutes | null>(null);
  // 되돌리기, 이동 뒤 같은 조건으로 다시 받는다
  const [reloadToken, setReloadToken] = useState(0);
  const [items, setItems] = useState<ArchiveMinutes[]>([]);
  // 마지막으로 받은 요청. 지금 조건과 다르면 불러오는 중이다
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const switcherRef = useRef<HTMLButtonElement>(null);
  const sortRef = useRef<HTMLButtonElement>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeSwitcher = useCallback(() => setIsSwitcherOpen(false), []);
  const closeSort = useCallback(() => setIsSortOpen(false), []);
  const showError = useCallback((error: unknown) => setToast({ text: errorMessage(error), variant: 'error' }), []);
  // REQ-180 검색어, 필터, 정렬은 주소에 둬서 회의록을 보고 뒤로 와도 그대로다
  const [searchParams, setSearchParams] = useSearchParams();
  const paramsKey = searchParams.toString();
  const query = searchParams.get('q') ?? '';
  const sort: ArchiveQuery['sort'] = searchParams.get('sort') === 'OLDEST' ? 'OLDEST' : 'LATEST';
  const filters = useMemo(() => filtersOf(new URLSearchParams(paramsKey)), [paramsKey]);
  const updateParams = (patch: { q?: string; sort?: ArchiveQuery['sort']; filters?: Filters }) => {
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
    setSearchParams(next, { replace: true });
  };
  const applyQuery = (q: string) => updateParams({ q });
  const applyFilters = (next: Filters) => updateParams({ filters: next });
  const applySort = (next: ArchiveQuery['sort']) => updateParams({ sort: next });

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
      .then((items) => isCurrent && setViewed(items))
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [id, showError]);

  const requestKey = JSON.stringify([id, query, filters, sort, page, reloadToken]);
  const isLoading = loadedKey !== requestKey;

  // 검색어·필터·정렬이 바뀌면 첫 쪽부터 다시 받는다
  useEffect(() => {
    let isCurrent = true;
    const archiveQuery: ArchiveQuery = {
      q: query,
      from: filters.period?.from,
      to: filters.period?.to,
      locations: filters.locations,
      attendeeIds: filters.attendeeIds,
      sort,
    };
    listWorkspaceMinutes(id, archiveQuery, page)
      .then((result) => {
        if (isCurrent) {
          setLoadedKey(requestKey);
          setItems((prev) => (page === 0 ? result.items : [...prev, ...result.items]));
          setTotalCount(result.totalCount);
          setHasNext(result.hasNext);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setLoadedKey(requestKey);
          showError(error);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [id, query, filters, sort, page, requestKey, showError]);

  const changeFilters = (next: Filters) => {
    applyFilters(next);
    setPage(0);
    setOpenFilter(null);
  };
  const search = (event: FormEvent) => {
    event.preventDefault();
    applyQuery(keyword);
    setPage(0);
  };
  const toggleFilter = (key: FilterKey) => setOpenFilter((open) => (open === key ? null : key));
  const openMinutes = (meetingId: number) => navigate(`/meetings/${meetingId}/minutes`);

  // REQ-160 링크 복사 (MSG-064)
  const copyLink = async (item: ArchiveMinutes) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meetings/${item.meetingId}/minutes`);
      setToast({ text: '링크를 복사했어요.', variant: 'success' });
    } catch {
      setToast({ text: '링크를 복사하지 못했어요. 다시 시도해 주세요.', variant: 'error' });
    }
  };

  // REQ-160 회의록 삭제: 회의와 함께 삭제 목록으로 (REQ-143). [되돌리기] 5초
  const removeMinutes = async (item: ArchiveMinutes) => {
    try {
      await trashMeeting(item.meetingId);
      setItems((prev) => prev.filter(({ minutesId }) => minutesId !== item.minutesId));
      setTotalCount((count) => Math.max(0, count - 1));
      setToast({
        text: `'${item.title}'을 삭제했어요.`,
        variant: 'info',
        action: {
          label: '되돌리기',
          onClick: () => {
            restoreMeeting(item.meetingId)
              .then(() => setReloadToken((value) => value + 1))
              .catch(showError);
          },
        },
      });
    } catch (error) {
      showError(error);
    }
  };

  const memberName = (userId: number) => members.find((member) => member.userId === userId)?.name ?? '알 수 없는 사용자';
  const periodLabel = !filters.period
    ? '전체 기간'
    : filters.period.from === filters.period.to
      ? formatPeriodDate(filters.period.from).slice(0, -1)
      : `${formatPeriodDate(filters.period.from).slice(0, -1)} - ${formatPeriodDate(filters.period.to).slice(0, -1)}`;
  const hasFilters = Boolean(filters.period || filters.locations.length || filters.attendeeIds.length);

  return (
    <AppLayout className={styles.page} workspaceId={id}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <p className={styles.breadcrumb}>회의록 아카이브</p>
      <div className={styles.columns}>
        <div className={styles.main}>
          <div className={styles.titleBlock}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>회의록 아카이브</h1>
              <span className={styles.anchor}>
                <button
                  ref={switcherRef}
                  type="button"
                  className={styles.workspaceButton}
                  aria-label="워크스페이스 전환"
                  aria-expanded={isSwitcherOpen}
                  onClick={() => setIsSwitcherOpen((open) => !open)}
                >
                  {workspace?.name}
                  <Icon src={chevronIcon} size={ICON_SIZE} className={isSwitcherOpen ? undefined : styles.flipped} />
                </button>
                {isSwitcherOpen && (
                  <WorkspaceSwitcher
                    workspaces={workspaces}
                    currentId={id}
                    anchorRef={switcherRef}
                    onSelect={(selectedId) => {
                      closeSwitcher();
                      applyFilters(EMPTY_FILTERS);
                      setPage(0);
                      navigate(`/workspaces/${selectedId}/archive`);
                    }}
                    onCreate={() => {
                      closeSwitcher();
                      setIsCreatingWorkspace(true);
                    }}
                    onClose={closeSwitcher}
                  />
                )}
              </span>
            </div>
            <p className={styles.description}>지난 회의록을 검색하고 필요한 기록을 빠르게 찾아봐요</p>
          </div>

          <div className={styles.searchCard}>
            <form className={styles.searchRow} role="search" onSubmit={search}>
              <label className={styles.searchField}>
                <Icon src={searchIcon} size={SEARCH_ICON_SIZE} className={styles.mutedIcon} />
                <input
                  className={styles.searchInput}
                  placeholder="회의명, 내용으로 검색"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </label>
              <button type="submit" className={styles.searchButton}>
                검색
              </button>
            </form>
            <div className={styles.filters}>
              <div className={styles.chips}>
                <FilterChip
                  label={periodLabel}
                  isApplied={Boolean(filters.period)}
                  isOpen={openFilter === 'period'}
                  onToggle={() => toggleFilter('period')}
                  onClear={() => changeFilters({ ...filters, period: null })}
                >
                  <PeriodPicker value={filters.period} onChange={(period) => changeFilters({ ...filters, period })} />
                </FilterChip>
                <FilterChip
                  label={filters.locations.length ? filters.locations.join(', ') : '전체 장소'}
                  isApplied={filters.locations.length > 0}
                  isOpen={openFilter === 'location'}
                  onToggle={() => toggleFilter('location')}
                  onClear={() => changeFilters({ ...filters, locations: [] })}
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
                  onClear={() => changeFilters({ ...filters, attendeeIds: [] })}
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
              </div>
              <button
                type="button"
                className={styles.reset}
                disabled={!hasFilters}
                onClick={() => changeFilters(EMPTY_FILTERS)}
              >
                <Icon src={refreshIcon} size={ICON_SIZE} />
                필터 초기화
              </button>
            </div>
          </div>
        </div>

        <aside className={styles.side} aria-labelledby="viewed-title">
          <h2 id="viewed-title" className={styles.sideTitle}>
            최근 본 회의록
          </h2>
          <ul className={styles.viewed}>
            {viewed.length === 0 && <li className={styles.viewedEmpty}>최근 본 회의록이 없어요.</li>}
            {viewed.map((item) => (
              <li key={item.minutesId}>
                <button type="button" className={styles.viewedItem} onClick={() => openMinutes(item.meetingId)}>
                  <span className={styles.viewedIcon}>
                    <Icon src={minutesIcon} size={VIEWED_ICON_SIZE} />
                  </span>
                  <span className={styles.viewedText}>
                    <span className={styles.viewedTitle}>{item.title}</span>
                    <span className={styles.viewedDate}>{formatDateTime(item.meetingStartAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className={styles.list} aria-labelledby="archive-count">
        <div className={styles.listHead}>
          <h2 id="archive-count" className={styles.count}>
            {totalCount}개의 회의록
          </h2>
          <span className={styles.anchor}>
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
                items={(['LATEST', 'OLDEST'] as const).map((option) => ({
                  id: option,
                  label: SORT_LABELS[option],
                  isSelected: sort === option,
                }))}
                onSelect={(option) => {
                  applySort(option as ArchiveQuery['sort']);
                  setPage(0);
                  closeSort();
                }}
                onClose={closeSort}
              />
            )}
          </span>
        </div>
        {/* 디자인 ArchiveLoadingPage: 첫 쪽을 받는 동안 회색 줄 */}
        {isLoading && page === 0 ? (
          <div className={styles.loadingRows}>
            {Array.from({ length: LOADING_ROWS }, (_, index) => (
              <Skeleton key={index} height={ROW_HEIGHT} />
            ))}
          </div>
        ) : items.length === 0 ? (
          // 디자인 ArchiveEmptyResultPage
          query || hasFilters ? (
            <EmptyState
              title="검색 결과가 없어요"
              description="다른 검색어를 입력하거나 필터를 줄여 보세요"
              action={
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setKeyword('');
                    applyQuery('');
                    changeFilters(EMPTY_FILTERS);
                  }}
                >
                  필터 초기화
                </Button>
              }
            />
          ) : (
            <EmptyState title="아직 확정된 회의록이 없어요" description="회의록을 확정하면 이곳에서 찾아볼 수 있어요" />
          )
        ) : (
        <ArchiveTable
          items={items}
          onOpen={(item) => openMinutes(item.meetingId)}
          rowMenu={(item) => [
            { label: '회의록 보기', icon: minutesIcon, onSelect: () => openMinutes(item.meetingId) },
            {
              label: '다운로드',
              icon: downloadIcon,
              onSelect: () => navigate(`/meetings/${item.meetingId}/minutes?download=1`),
            },
            { label: '링크 복사', icon: copyIcon, onSelect: () => void copyLink(item) },
            { label: '다른 폴더로 이동', icon: moveIcon, onSelect: () => setMoving(item) },
            { label: '회의록 삭제', icon: deleteIcon, isDanger: true, onSelect: () => void removeMinutes(item) },
          ]}
        />
        )}
        {hasNext && (
          <button type="button" className={styles.more} onClick={() => setPage((value) => value + 1)}>
            더 보기
          </button>
        )}
      </section>
      {isCreatingWorkspace && <CreateWorkspaceModal onClose={() => setIsCreatingWorkspace(false)} />}
      {moving && (
        <MoveMeetingModal
          meetingId={moving.meetingId}
          title={moving.title}
          workspaceId={id}
          currentFolderId={moving.folderId}
          onMoved={(folderName) => {
            setToast({ text: `'${moving.title}'을 ${folderName} 폴더로 옮겼어요.`, variant: 'success' });
            setMoving(null);
            setReloadToken((value) => value + 1);
          }}
          onClose={() => setMoving(null)}
        />
      )}
    </AppLayout>
  );
}
