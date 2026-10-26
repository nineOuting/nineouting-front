import { Fragment, useState } from 'react';
import dividerMeetingRow from '../../assets/divider-meeting-row.svg';
import AvatarStack from '../../components/AvatarStack';
import Placeholder from '../../components/Placeholder';
import type { FolderMeeting, FolderMeetingStatus } from '../../types/workspace';
import styles from './MeetingTable.module.css';

const ICON_SIZE = 16;
const ROW_DIVIDER_WIDTH = 767;
const ATTENDEE_FACES = 4;

const STATUS_LABELS: Record<FolderMeetingStatus, string> = {
  scheduled: '예정',
  inProgress: '진행 중',
  writing: '회의록 작성 중',
  reviewing: '검토 중',
  confirmed: '확정',
};

const STATUS_ORDER: FolderMeetingStatus[] = ['scheduled', 'inProgress', 'writing', 'reviewing', 'confirmed'];

type SortKey = 'title' | 'date' | 'status' | 'writer';

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
}

/** REQ-048 폴더 안의 회의 목록. 기본은 날짜 최신순, 머리글을 누르면 그 열로 정렬한다 */
export default function MeetingTable({ meetings, onOpen }: MeetingTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; isAscending: boolean }>({ key: 'date', isAscending: false });

  const sorted = [...meetings].sort((a, b) => {
    const order = compare(a, b, sort.key);
    return sort.isAscending ? order : -order;
  });

  const toggleSort = (key: SortKey) =>
    setSort((current) => ({ key, isAscending: current.key === key ? !current.isAscending : key !== 'date' }));

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
                  <Placeholder size={ICON_SIZE} />
                </button>
              </th>
            ))}
            <th scope="col" className={styles.attendees}>
              참여자
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              {/* MSG-034 */}
              <td colSpan={5} className={styles.empty}>
                아직 회의가 없습니다. [새 회의]를 눌러 첫 회의를 만들어 보세요.
              </td>
            </tr>
          ) : (
            sorted.map((meeting, index) => (
              <Fragment key={meeting.meetingId}>
                {index > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={5} className={styles.dividerCell}>
                      <img src={dividerMeetingRow} alt="" width={ROW_DIVIDER_WIDTH} height={1} className={styles.divider} />
                    </td>
                  </tr>
                )}
                <tr className={styles.row} onClick={() => onOpen(meeting)}>
                  <td className={styles.title}>
                    {/* 키보드로도 열 수 있게 버튼을 둔다. 누르면 줄의 클릭으로 이어진다 */}
                    <button type="button" className={styles.titleButton}>
                      {meeting.title}
                    </button>
                  </td>
                  <td className={styles.date}>{meeting.date.replaceAll('-', '.')}</td>
                  <td className={styles.status}>
                    <span className={`${styles.pill} ${styles[meeting.status]}`}>
                      <Placeholder size={ICON_SIZE} />
                      {STATUS_LABELS[meeting.status]}
                    </span>
                  </td>
                  <td className={styles.writer}>
                    <span className={styles.writerCell}>
                      <span className={styles.face} aria-hidden="true" />
                      <span className={styles.writerName}>
                        {meeting.writer.affiliation
                          ? `${meeting.writer.name}ㅣ${meeting.writer.affiliation}`
                          : meeting.writer.name}
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
                </tr>
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
