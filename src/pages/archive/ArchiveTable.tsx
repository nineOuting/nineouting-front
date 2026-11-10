import { useRef, useState } from 'react';
import type { ArchiveMinutes } from '../../api/minutes';
import AvatarStack from '../../components/AvatarStack';
import moreIcon from '../../assets/icons/more-vert.svg';
import folderIcon from '../../assets/icons/folder-meta.svg';
import locationIcon from '../../assets/icons/location.svg';
import Icon from '../../components/Icon';
import { formatDateTime } from '../../utils/meetingFormat';
import ActionMenu, { type ActionMenuItem } from '../workspace/ActionMenu';
import styles from './ArchiveTable.module.css';

const ICON_SIZE = 16;
const MORE_ICON_SIZE = 20;
const AVATAR_MAX = 3;

interface ArchiveTableProps {
  items: ArchiveMinutes[];
  onOpen: (item: ArchiveMinutes) => void;
  /** REQ-160 줄마다 ⋮ 메뉴: 회의록 보기, 다운로드, 링크 복사, 다른 폴더로 이동, 회의록 삭제 */
  rowMenu: (item: ArchiveMinutes) => ActionMenuItem[];
}

/** REQ-053 아카이브 목록 (디자인 23:1336). 줄을 누르면 회의록을 연다 */
export default function ArchiveTable({ items, onOpen, rowMenu }: ArchiveTableProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div className={styles.table} role="table" aria-label="회의록 목록">
      <div className={`${styles.row} ${styles.head}`} role="row">
        <span className={styles.title} role="columnheader">
          회의명
        </span>
        <span className={styles.folder} role="columnheader">
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
          <span className={styles.hidden}>메뉴</span>
        </span>
      </div>
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
              <Icon src={folderIcon} size={ICON_SIZE} className={styles.mutedIcon} />
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
                  <Icon src={locationIcon} size={ICON_SIZE} className={styles.mutedIcon} />
                  <span className={styles.ellipsis}>{item.location}</span>
                </>
              )}
            </span>
            {/* 줄을 누르면 회의록을 열므로 메뉴의 클릭, 키는 줄로 올리지 않는다 */}
            <span
              className={styles.action}
              role="cell"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <span className={styles.menuAnchor}>
                <button
                  ref={openMenuId === item.minutesId ? menuAnchorRef : undefined}
                  type="button"
                  className={styles.iconButton}
                  aria-label={`${item.title} 메뉴`}
                  aria-haspopup="menu"
                  aria-expanded={openMenuId === item.minutesId}
                  onClick={() => setOpenMenuId((current) => (current === item.minutesId ? null : item.minutesId))}
                >
                  <Icon src={moreIcon} size={MORE_ICON_SIZE} />
                </button>
                {openMenuId === item.minutesId && (
                  <ActionMenu
                    label={`${item.title} 메뉴`}
                    anchorRef={menuAnchorRef}
                    className={styles.menu}
                    items={rowMenu(item).map((entry) => ({
                      ...entry,
                      onSelect: () => {
                        setOpenMenuId(null);
                        entry.onSelect();
                      },
                    }))}
                    onClose={() => setOpenMenuId(null)}
                  />
                )}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
