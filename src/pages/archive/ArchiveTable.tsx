import type { ArchiveMinutes } from '../../api/minutes';
import AvatarStack from '../../components/AvatarStack';
import Placeholder from '../../components/Placeholder';
import { formatDateTime } from '../../utils/meetingFormat';
import styles from './ArchiveTable.module.css';

const ICON_SIZE = 16;
const AVATAR_MAX = 3;

interface ArchiveTableProps {
  items: ArchiveMinutes[];
  onOpen: (item: ArchiveMinutes) => void;
  onDownload: (item: ArchiveMinutes) => void;
}

/** REQ-053 아카이브 목록 (디자인 23:1336). 줄을 누르면 회의록을 연다 */
export default function ArchiveTable({ items, onOpen, onDownload }: ArchiveTableProps) {
  return (
    <div className={styles.table} role="table" aria-label="회의록 목록">
      <div className={`${styles.row} ${styles.head}`} role="row">
        <span className={styles.title} role="columnheader">
          회의명
        </span>
        <span className={styles.folder} role="columnheader">
          <Placeholder size={ICON_SIZE} />
          폴더
        </span>
        <span className={styles.date} role="columnheader">
          날짜
        </span>
        <span className={styles.people} role="columnheader">
          참석자
        </span>
        <span className={styles.location} role="columnheader">
          장소
        </span>
        <span className={styles.action} role="columnheader">
          작업
        </span>
      </div>
      {items.length === 0 && <p className={styles.empty}>조건에 맞는 회의록이 없어요.</p>}
      {items.map((item) => {
        const [date, time] = formatDateTime(item.meetingStartAt).split(/ (?=오)/);
        return (
          <div
            key={item.minutesId}
            className={`${styles.row} ${styles.item}`}
            role="row"
            tabIndex={0}
            onClick={() => onOpen(item)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onOpen(item);
              }
            }}
          >
            <span className={`${styles.title} ${styles.name}`} role="cell">
              {item.title}
            </span>
            <span className={styles.folder} role="cell">
              <Placeholder size={ICON_SIZE} />
              <span className={styles.ellipsis}>{item.folderName}</span>
            </span>
            <span className={styles.date} role="cell">
              {date}
              <br />
              {time}
            </span>
            <span className={styles.people} role="cell">
              <AvatarStack members={item.attendees} max={AVATAR_MAX} label={`참석자 ${item.attendees.length}명`} />
            </span>
            <span className={styles.location} role="cell">
              {item.location && (
                <>
                  <Placeholder size={ICON_SIZE} />
                  <span className={styles.ellipsis}>{item.location}</span>
                </>
              )}
            </span>
            <span className={styles.action} role="cell">
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`${item.title} 다운로드`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDownload(item);
                }}
              >
                <Placeholder size={ICON_SIZE} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
