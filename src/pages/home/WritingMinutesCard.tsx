import { Link } from 'react-router-dom';
import type { WritingMinutes } from '../../api/minutes';
import folderIcon from '../../assets/icons/folder-meta.svg';
import locationIcon from '../../assets/icons/location.svg';
import Icon from '../../components/Icon';
import { daysBetween, fromIsoDate } from '../../utils/calendar';
import { folderIconColor } from '../../utils/folderColor';
import card from './HomeCard.module.css';
import type { FolderOption } from './ProjectFilter';
import type { BackState } from '../../utils/meetingFormat';
import styles from './WritingMinutesCard.module.css';

const SMALL_ICON_SIZE = 16;

interface WritingMinutesCardProps {
  items: WritingMinutes[];
  /** 폴더 아이콘을 사용자가 고른 프로젝트 색으로 칠한다 (REQ-202) */
  folders: FolderOption[];
}

/** 회의 날부터 지난 날 (당일이면 0) */
function daysSince(meetingStartAt: string) {
  return Math.max(0, daysBetween(fromIsoDate(meetingStartAt), new Date()));
}

/**
 * REQ-149~150 작성 중인 회의록 (피그마 Page 8 DraftMinutesSection): 내가 작성자인 작성 중 회의록.
 * 회의명, D+n, 장소, 프로젝트. 누르면 회의록 작성 화면으로 간다
 */
export default function WritingMinutesCard({ items, folders }: WritingMinutesCardProps) {
  return (
    <section className={card.section} aria-labelledby="writing-title">
      <div className={card.sectionHead}>
        <h2 id="writing-title" className={card.title}>
          작성 중인 회의록
        </h2>
        <span className={card.count}>총 {items.length}개</span>
      </div>
      {items.length === 0 ? (
        <p className={`${card.listBox} ${card.boxEmpty}`}>작성 중인 회의록이 없어요.</p>
      ) : (
        <ul className={`${card.listBox} ${styles.list}`}>
          {items.map((item) => {
            const days = daysSince(item.meetingStartAt);
            const folder = folders.find(({ folderId }) => folderId === item.folderId);
            return (
              <li key={item.minutesId}>
                <Link to={`/meetings/${item.meetingId}/minutes`} state={{ backTo: '/home' } satisfies BackState} className={styles.item}>
                  <span className={styles.titleRow}>
                    <span className={card.rowTitle}>{item.title}</span>
                    <span className={card.badgeNeutral}>{days === 0 ? 'D-day' : `D+${days}`}</span>
                  </span>
                  <span className={styles.meta}>
                    {item.location && (
                      <span className={styles.metaItem}>
                        <Icon src={locationIcon} size={SMALL_ICON_SIZE} />
                        {item.location}
                      </span>
                    )}
                    <span className={styles.metaItem}>
                      {/* 폴더 목록을 받기 전에는 회색 */}
                      <span className={styles.folderIcon} style={folder ? { color: folderIconColor(folder.color) } : undefined}>
                        <Icon src={folderIcon} size={SMALL_ICON_SIZE} />
                      </span>
                      {item.folderName}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
