import { useRef, useState } from 'react';
import type { ArchiveMinutes } from '../../api/minutes';
import downloadIcon from '../../assets/icons/download.svg';
import folderIcon from '../../assets/icons/folder-sm.svg';
import moreIcon from '../../assets/icons/more-vert.svg';
import Icon from '../../components/Icon';
import { folderIconColor } from '../../utils/folderColor';
import ActionMenu, { type ActionMenuItem } from '../workspace/ActionMenu';
import styles from './ArchiveTable.module.css';

const ICON_SIZE = 16;
const ACTION_ICON_SIZE = 20;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 2026-10-24T10:00:00 → 10.24(토) 10:00 (디자인 일시 열) */
function formatShortDateTime(dateTime: string) {
  const [year, month, day] = dateTime.slice(0, 10).split('-').map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${dateTime.slice(5, 7)}.${dateTime.slice(8, 10)}(${weekday}) ${dateTime.slice(11, 16)}`;
}

interface ArchiveTableProps {
  items: ArchiveMinutes[];
  /** 폴더 아이콘 색 (REQ-202 프로젝트 색) */
  folderColors: Map<number, number | undefined>;
  onOpen: (item: ArchiveMinutes) => void;
  onDownload: (item: ArchiveMinutes) => void;
  /** REQ-160 줄마다 ⋮ 메뉴: 회의록 보기, 다운로드, 링크 복사, 다른 폴더로 이동, 회의록 삭제 */
  rowMenu: (item: ArchiveMinutes) => ActionMenuItem[];
}

/** REQ-053 아카이브 목록 (디자인 Page 9 ArchivePage): 회의명, 폴더, 일시, 참석자, 장소, 작업. 줄을 누르면 회의록을 연다 */
export default function ArchiveTable({ items, folderColors, onOpen, onDownload, rowMenu }: ArchiveTableProps) {
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
          일시
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
      {items.map((item) => (
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
            <span className={styles.folderIcon} style={{ color: folderIconColor(folderColors.get(item.folderId)) }}>
              <Icon src={folderIcon} size={ICON_SIZE} />
            </span>
            <span className={styles.ellipsis}>{item.folderName}</span>
          </span>
          <span className={styles.date} role="cell">
            {formatShortDateTime(item.meetingStartAt)}
          </span>
          <span className={styles.people} role="cell">
            {item.attendees.length}명
          </span>
          <span className={`${styles.location} ${styles.ellipsis}`} role="cell">
            {item.location}
          </span>
          {/* 줄을 누르면 회의록을 열므로 버튼의 클릭, 키는 줄로 올리지 않는다 */}
          <span
            className={styles.action}
            role="cell"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.iconButton}
              aria-label={`${item.title} 다운로드`}
              onClick={() => onDownload(item)}
            >
              <Icon src={downloadIcon} size={ACTION_ICON_SIZE} />
            </button>
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
                <Icon src={moreIcon} size={ACTION_ICON_SIZE} />
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
      ))}
    </div>
  );
}
