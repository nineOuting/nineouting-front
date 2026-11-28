import { useRef, useState, type ReactNode } from 'react';
import type { ArchiveMinutes, ExportFormat } from '../../api/minutes';
import folderIcon from '../../assets/icons/folder-sm.svg';
import moreIcon from '../../assets/icons/more-vert.svg';
import Icon from '../../components/Icon';
import Skeleton from '../../components/Skeleton';
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
  /** 피그마 프론트 "다운로드 메뉴": 형식(PDF, Word)을 고르면 바로 받는다 */
  onDownload: (item: ArchiveMinutes, format: ExportFormat) => void;
  /** REQ-160 줄마다 ⋮ 메뉴: 회의록 보기, 다운로드, 링크 복사, 회의록 삭제. openDownload는 형식 메뉴를 연다 */
  rowMenu: (item: ArchiveMinutes, openDownload: () => void) => ActionMenuItem[];
  /** 목록이 비었을 때 머리 줄 아래 보여 줄 내용 (디자인 10 상태 모음: 머리 줄은 그대로 둔다) */
  empty?: ReactNode;
  /** 처음 불러오는 동안: 머리 줄은 그대로 그리고, 그 아래 실제 줄과 같은 칸·높이의 회색 줄을 이만큼 */
  loadingRows?: number;
}

// 불러오는 동안 칸마다 회색 자리 (글자 줄 높이 20). 장소·작업 칸은 비워 둔다
const SKELETON_TEXT_HEIGHT = 20;
const SKELETON_WIDTHS = { title: 240, folder: 96, date: 96, people: 40 };

/** REQ-053 아카이브 목록 (디자인 Page 9 ArchivePage): 회의명, 폴더, 일시, 참석자, 장소, 작업. 줄을 누르면 회의록을 연다 */
export default function ArchiveTable({ items, folderColors, onOpen, onDownload, rowMenu, empty, loadingRows }: ArchiveTableProps) {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  // 줄 메뉴와 다운로드 형식 메뉴는 같은 ⋮ 버튼에 붙는다 (디자인 10: 작업 칸에는 ⋮ 하나만)
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [downloadMenuId, setDownloadMenuId] = useState<number | null>(null);
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
      {loadingRows !== undefined &&
        Array.from({ length: loadingRows }, (_, index) => (
          <div key={index} className={styles.row} aria-hidden="true">
            <span className={styles.title}>
              <Skeleton width={SKELETON_WIDTHS.title} height={SKELETON_TEXT_HEIGHT} />
            </span>
            <span className={styles.folder}>
              <Skeleton width={SKELETON_WIDTHS.folder} height={SKELETON_TEXT_HEIGHT} />
            </span>
            <span className={styles.date}>
              <Skeleton width={SKELETON_WIDTHS.date} height={SKELETON_TEXT_HEIGHT} />
            </span>
            <span className={styles.people}>
              <Skeleton width={SKELETON_WIDTHS.people} height={SKELETON_TEXT_HEIGHT} />
            </span>
            {/* 장소는 없는 회의록도 많고, 작업 버튼은 마우스를 올려야 보여서 회색 자리 없이 빈 칸 */}
            <span className={styles.location} />
            <span className={styles.action} />
          </div>
        ))}
      {loadingRows === undefined && items.length === 0 && empty}
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
            <span
              className={[styles.menuAnchor, openMenuId === item.minutesId || downloadMenuId === item.minutesId ? styles.menuOpen : '']
                .filter(Boolean)
                .join(' ')}
            >
              <button
                ref={openMenuId === item.minutesId || downloadMenuId === item.minutesId ? menuAnchorRef : undefined}
                type="button"
                className={styles.iconButton}
                aria-label={`${item.title} 메뉴`}
                aria-haspopup="menu"
                aria-expanded={openMenuId === item.minutesId || downloadMenuId === item.minutesId}
                onClick={() => {
                  setDownloadMenuId(null);
                  setOpenMenuId((current) => (current === item.minutesId ? null : item.minutesId));
                }}
              >
                <Icon src={moreIcon} size={ACTION_ICON_SIZE} />
              </button>
              {downloadMenuId === item.minutesId && (
                <ActionMenu
                  label="다운로드 형식"
                  anchorRef={menuAnchorRef}
                  className={styles.menu}
                  items={[
                    { label: 'PDF로 다운로드', onSelect: () => onDownload(item, 'PDF') },
                    { label: 'Word (.docx)로 다운로드', onSelect: () => onDownload(item, 'DOCX') },
                  ].map((entry) => ({
                    ...entry,
                    onSelect: () => {
                      setDownloadMenuId(null);
                      entry.onSelect();
                    },
                  }))}
                  onClose={() => setDownloadMenuId(null)}
                />
              )}
              {openMenuId === item.minutesId && (
                <ActionMenu
                  label={`${item.title} 메뉴`}
                  anchorRef={menuAnchorRef}
                  className={styles.menu}
                  items={rowMenu(item, () => setDownloadMenuId(item.minutesId)).map((entry) => ({
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
