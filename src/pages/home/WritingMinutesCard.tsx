import { Link } from 'react-router-dom';
import type { WritingMinutes } from '../../api/minutes';
import chevronRightIcon from '../../assets/icons/chevron-right-sm.svg';
import folderIcon from '../../assets/icons/folder-meta.svg';
import locationIcon from '../../assets/icons/location.svg';
import { daysBetween, fromIsoDate } from '../../utils/calendar';
import card from './HomeCard.module.css';
import styles from './WritingMinutesCard.module.css';

const SMALL_ICON_SIZE = 16;
const ARROW_ICON_SIZE = 20;
// 회의 뒤 이만큼 지나면 배지를 빨갛게 보여 서두르게 한다
const OVERDUE_DAYS = 3;

interface WritingMinutesCardProps {
  items: WritingMinutes[];
}

/** 회의 날부터 지난 날 (당일이면 0) */
function daysSince(meetingStartAt: string) {
  return Math.max(0, daysBetween(fromIsoDate(meetingStartAt), new Date()));
}

/** REQ-142 작성 중인 회의록: 내가 작성자인 작성 중 회의록. 누르면 회의록 작성 화면으로 간다 */
export default function WritingMinutesCard({ items }: WritingMinutesCardProps) {
  return (
    <section className={card.card} aria-labelledby="writing-title">
      <div className={card.titleGroup}>
        <h2 id="writing-title" className={card.title}>
          작성 중인 회의록
        </h2>
        {items.length > 0 && <p className={card.subtitle}>마무리가 필요한 회의록 {items.length}개</p>}
      </div>
      {items.length === 0 ? (
        <div className={card.empty}>
          <p className={card.emptyTitle}>작성 중인 회의록이 없어요</p>
          <p className={card.emptyCaption}>{'마무리가 필요한 회의록이 생기면 \n이곳에서 바로 이어서 작성할 수 있어요.'}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const days = daysSince(item.meetingStartAt);
            return (
              <li key={item.minutesId}>
                <Link to={`/meetings/${item.meetingId}/minutes`} className={styles.item}>
                  <span className={styles.info}>
                    <span className={styles.titleRow}>
                      <span className={styles.title}>{item.title}</span>
                      <span className={days >= OVERDUE_DAYS ? card.badge : card.badgeNeutral}>
                        {days === 0 ? 'D-day' : `D+${days}`}
                      </span>
                    </span>
                    <span className={styles.meta}>
                      {item.location && (
                        <span className={card.withIcon}>
                          <img src={locationIcon} alt="" width={SMALL_ICON_SIZE} height={SMALL_ICON_SIZE} />
                          <span className={card.caption}>{item.location}</span>
                        </span>
                      )}
                      <span className={card.withIcon}>
                        <img src={folderIcon} alt="" width={SMALL_ICON_SIZE} height={SMALL_ICON_SIZE} />
                        <span className={card.caption}>{item.folderName}</span>
                      </span>
                    </span>
                  </span>
                  <img src={chevronRightIcon} alt="" width={ARROW_ICON_SIZE} height={ARROW_ICON_SIZE} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
