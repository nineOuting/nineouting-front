import { useRef, useState, type ReactNode } from 'react';
import chevronIcon from '../../assets/icons/chevron-up-sm.svg';
import moreIcon from '../../assets/icons/more-vert.svg';
import AvatarStack from '../../components/AvatarStack';
import Icon from '../../components/Icon';
import type { FolderMeeting, FolderMeetingStatus } from '../../types/workspace';
import ActionMenu, { type ActionMenuItem } from '../workspace/ActionMenu';
import styles from './MeetingTable.module.css';

const ICON_SIZE = 16;
const ATTENDEE_FACES = 4;
const MORE_ICON_SIZE = 20;
// REQ-168 한 페이지 20건
export const MEETING_PAGE_SIZE = 20;

const STATUS_LABELS: Record<FolderMeetingStatus, string> = {
  scheduled: '예정',
  inProgress: '회의 진행 중',
  writing: '회의록 작성 중',
  reviewing: '회의록 검토 중',
  confirmed: '회의록 확정',
};

const STATUS_ORDER: FolderMeetingStatus[] = ['scheduled', 'inProgress', 'writing', 'reviewing', 'confirmed'];

export type SortKey = 'title' | 'date' | 'status' | 'writer';

export interface MeetingSort {
  key: SortKey;
  isAscending: boolean;
}

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'title', label: '회의명' },
  { key: 'date', label: '날짜' },
  { key: 'status', label: '상태' },
  { key: 'writer', label: '작성자' },
];

function compare(a: FolderMeeting, b: FolderMeeting, key: SortKey) {
  switch (key) {
    case 'title':
      return a.title.localeCompare(b.title, 'ko');
    case 'date':
      return a.date.localeCompare(b.date);
    case 'status':
      return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    case 'writer':
      return a.writer.name.localeCompare(b.writer.name, 'ko');
  }
}

interface MeetingTableProps {
  meetings: FolderMeeting[];
  onOpen: (meeting: FolderMeeting) => void;
  /** REQ-167 정렬 (뒤로 가기에도 남도록 화면이 주소에 들고 있다, REQ-180) */
  sort: MeetingSort;
  onSortChange: (sort: MeetingSort) => void;
  /** REQ-168 0부터 */
  page: number;
  onPageChange: (page: number) => void;
  /** REQ-166 줄마다 ⋮ 메뉴 */
  rowMenu: (meeting: FolderMeeting) => ActionMenuItem[];
  /** 회의가 하나도 없을 때 표 대신 보인다 (MSG-034) */
  empty: ReactNode;
}

/** REQ-048 폴더 안의 회의 목록. 기본은 날짜 최신순, 머리글을 누르면 그 열로 정렬한다. 20건씩 나눠 보여 준다 */
export default function MeetingTable({
  meetings,
  onOpen,
  sort,
  onSortChange,
  page,
  onPageChange,
  rowMenu,
  empty,
}: MeetingTableProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);

  const sorted = [...meetings].sort((a, b) => {
    const order = compare(a, b, sort.key);
    return sort.isAscending ? order : -order;
  });

  const toggleSort = (key: SortKey) =>
    onSortChange({ key, isAscending: sort.key === key ? !sort.isAscending : key !== 'date' });
  const pageCount = Math.max(1, Math.ceil(sorted.length / MEETING_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const rows = sorted.slice(currentPage * MEETING_PAGE_SIZE, (currentPage + 1) * MEETING_PAGE_SIZE);

  if (meetings.length === 0) {
    return <div className={styles.card}>{empty}</div>;
  }

  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headRow}>
            {SORT_COLUMNS.map(({ key, label }) => (
              <th
                key={key}
                scope="col"
                className={styles[key]}
                aria-sort={sort.key === key ? (sort.isAscending ? 'ascending' : 'descending') : undefined}
              >
                <button type="button" className={styles.sortButton} onClick={() => toggleSort(key)}>
                  {label}
                  {sort.key === key && (
                    <Icon src={chevronIcon} size={ICON_SIZE} className={sort.isAscending ? undefined : styles.flipped} />
                  )}
                </button>
              </th>
            ))}
            <th scope="col" className={styles.attendees}>
              참여자
            </th>
            <th scope="col" className={styles.more}>
              <span className={styles.hidden}>메뉴</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((meeting) => (
            <tr key={meeting.meetingId} className={styles.row} onClick={() => onOpen(meeting)}>
              <td className={styles.title}>
                {/* 키보드로도 열 수 있게 버튼을 둔다. 누르면 줄의 클릭으로 이어진다 */}
                <button type="button" className={styles.titleButton}>
                  {meeting.title}
                </button>
              </td>
              <td className={styles.date}>{meeting.date.replaceAll('-', '.')}</td>
              <td className={styles.status}>
                <span className={`${styles.badge} ${styles[meeting.status]}`}>{STATUS_LABELS[meeting.status]}</span>
              </td>
              <td className={styles.writer}>
                <span className={styles.writerCell}>
                  <span className={styles.face} aria-hidden="true" />
                  <span className={styles.writerName} title={meeting.writer.affiliation ?? undefined}>
                    {meeting.writer.name}
                  </span>
                </span>
              </td>
              <td className={styles.attendees}>
                <AvatarStack
                  members={meeting.attendees}
                  max={ATTENDEE_FACES}
                  label={`참여자 ${meeting.attendees.length}명`}
                />
              </td>
              {/* 줄을 누르면 회의로 가므로 메뉴 칸의 클릭은 줄로 올리지 않는다 */}
              <td className={styles.more} onClick={(event) => event.stopPropagation()}>
                <span className={styles.menuAnchor}>
                  <button
                    ref={openMenuId === meeting.meetingId ? menuAnchorRef : undefined}
                    type="button"
                    className={styles.moreButton}
                    aria-label={`${meeting.title} 메뉴`}
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === meeting.meetingId}
                    onClick={() => setOpenMenuId((current) => (current === meeting.meetingId ? null : meeting.meetingId))}
                  >
                    <Icon src={moreIcon} size={MORE_ICON_SIZE} />
                  </button>
                  {openMenuId === meeting.meetingId && (
                    <ActionMenu
                      label={`${meeting.title} 메뉴`}
                      anchorRef={menuAnchorRef}
                      className={styles.menu}
                      items={rowMenu(meeting).map((item) => ({
                        ...item,
                        onSelect: () => {
                          setOpenMenuId(null);
                          item.onSelect();
                        },
                      }))}
                      onClose={() => setOpenMenuId(null)}
                    />
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pageCount > 1 && (
        // REQ-168 페이지 번호
        <nav className={styles.pager} aria-label="회의 목록 페이지">
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              type="button"
              className={index === currentPage ? `${styles.pageButton} ${styles.pageCurrent}` : styles.pageButton}
              aria-current={index === currentPage ? 'page' : undefined}
              onClick={() => onPageChange(index)}
            >
              {index + 1}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
