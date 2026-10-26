import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import Placeholder from '../../components/Placeholder';
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

const ICON_SIZE = 20;
const SORT_ICON_SIZE = 16;
const VIEWED_ICON_SIZE = 40;
const VIEWED_SIZE = 5;
const CREATE_WORKSPACE_PENDING_MESSAGE = '새 워크스페이스 만들기 화면은 디자인이 나오면 연결돼요.';
const SORT_LABELS = { LATEST: '최신순', OLDEST: '오래된순' } as const;

type FilterKey = 'period' | 'location' | 'attendee';

interface Filters {
  period: Period | null;
  locations: string[];
  attendeeIds: number[];
}

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
            <Placeholder size={ICON_SIZE} />
          </button>
        ) : (
          <button type="button" className={styles.iconButton} aria-hidden="true" tabIndex={-1} onClick={onToggle}>
            <Placeholder size={ICON_SIZE} />
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

/** REQ-053~055, 145~146 회의록 아카이브 (Figma 23-2). 워크스페이스에서 내가 들어갈 수 있는 폴더의 회의록을 모아 본다 */
export default function ArchivePage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const id = Number(workspaceId);
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [viewed, setViewed] = useState<ViewedMinutes[]>([]);
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<ArchiveQuery['sort']>('LATEST');
  const [items, setItems] = useState<ArchiveMinutes[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const switcherRef = useRef<HTMLButtonElement>(null);
  const sortRef = useRef<HTMLButtonElement>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeSwitcher = useCallback(() => setIsSwitcherOpen(false), []);
  const closeSort = useCallback(() => setIsSortOpen(false), []);
  const showError = useCallback((error: unknown) => setToast({ text: errorMessage(error), variant: 'error' }), []);

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
          setItems((prev) => (page === 0 ? result.items : [...prev, ...result.items]));
          setTotalCount(result.totalCount);
          setHasNext(result.hasNext);
        }
      })
      .catch(showError);
    return () => {
      isCurrent = false;
    };
  }, [id, query, filters, sort, page, showError]);

  const changeFilters = (next: Filters) => {
    setFilters(next);
    setPage(0);
    setOpenFilter(null);
  };
  const search = (event: FormEvent) => {
    event.preventDefault();
    setQuery(keyword);
    setPage(0);
  };
  const toggleFilter = (key: FilterKey) => setOpenFilter((open) => (open === key ? null : key));
  const openMinutes = (meetingId: number) => navigate(`/meetings/${meetingId}/minutes`);

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
                  <Placeholder size={ICON_SIZE} />
                </button>
                {isSwitcherOpen && (
                  <WorkspaceSwitcher
                    workspaces={workspaces}
                    currentId={id}
                    anchorRef={switcherRef}
                    onSelect={(selectedId) => {
                      closeSwitcher();
                      setFilters(EMPTY_FILTERS);
                      setPage(0);
                      navigate(`/workspaces/${selectedId}/archive`);
                    }}
                    onCreate={() => {
                      closeSwitcher();
                      setToast({ text: CREATE_WORKSPACE_PENDING_MESSAGE, variant: 'info' });
                    }}
                    onClose={closeSwitcher}
                  />
                )}
              </span>
            </div>
            <p className={styles.description}>지난 회의록을 검색하고 필요한 기록을 빠르게 찾아보세요.</p>
          </div>

          <div className={styles.searchCard}>
            <form className={styles.searchRow} role="search" onSubmit={search}>
              <label className={styles.searchField}>
                <Placeholder size={ICON_SIZE} />
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
                <Placeholder size={ICON_SIZE} />
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
                  <Placeholder size={VIEWED_ICON_SIZE} />
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
              <Placeholder size={SORT_ICON_SIZE} />
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
                  setSort(option as ArchiveQuery['sort']);
                  setPage(0);
                  closeSort();
                }}
                onClose={closeSort}
              />
            )}
          </span>
        </div>
        <ArchiveTable
          items={items}
          onOpen={(item) => openMinutes(item.meetingId)}
          onDownload={(item) => navigate(`/meetings/${item.meetingId}/minutes?download=1`)}
        />
        {hasNext && (
          <button type="button" className={styles.more} onClick={() => setPage((value) => value + 1)}>
            더 보기
          </button>
        )}
      </section>
    </AppLayout>
  );
}
