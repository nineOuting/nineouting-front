import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { WritingMinutes } from '../../api/minutes';
import dividerHomeCard from '../../assets/divider-home-card.svg';
import Placeholder from '../../components/Placeholder';
import { daysBetween, fromIsoDate } from '../../utils/calendar';
import card from './HomeCard.module.css';
import styles from './WritingMinutesCard.module.css';

const ICON_SIZE = 26;
const SMALL_ICON_SIZE = 16;
const ARROW_ICON_SIZE = 18;
const EMPTY_ICON_SIZE = 35;
const DIVIDER_WIDTH = 249;

interface WritingMinutesCardProps {
  items: WritingMinutes[];
}

/** 회의 날부터 지난 날 (당일이면 D-day) */
function dPlus(meetingStartAt: string) {
  const days = daysBetween(fromIsoDate(meetingStartAt), new Date());
  return days <= 0 ? 'D-day' : `D+${days}`;
}

/** REQ-142 작성 중인 회의록: 내가 작성자인 작성 중 회의록. 누르면 회의록 작성 화면으로 간다 */
export default function WritingMinutesCard({ items }: WritingMinutesCardProps) {
  return (
    <section className={`${card.card} ${styles.card}`} aria-labelledby="writing-title">
      <div className={card.head}>
        <h2 id="writing-title" className={card.title}>
          <Placeholder size={ICON_SIZE} />
          작성 중인 회의록
        </h2>
      </div>
      <img src={dividerHomeCard} alt="" width={DIVIDER_WIDTH} height={1} className={card.divider} />
      {items.length === 0 ? (
        <div className={card.empty}>
          <Placeholder size={EMPTY_ICON_SIZE} />
          <p className={card.emptyTitle}>작성 중인 회의록이 없어요</p>
          <p className={card.emptyCaption}>{'마무리가 필요한 회의록이 생기면 \n이곳에서 바로 이어서 작성할 수 있어요.'}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((item, index) => (
            <Fragment key={item.minutesId}>
              {index > 0 && (
                <li aria-hidden="true">
                  <img src={dividerHomeCard} alt="" width={DIVIDER_WIDTH} height={1} className={card.divider} />
                </li>
              )}
              <li>
                <Link to={`/meetings/${item.meetingId}/minutes`} className={styles.item}>
                  <span className={styles.info}>
                    <span className={styles.titleRow}>
                      <span className={`${card.body} ${styles.title}`}>{item.title}</span>
                      <span className={`${card.badge} ${styles.badge}`}>{dPlus(item.meetingStartAt)}</span>
                    </span>
                    <span className={styles.meta}>
                      {item.location && (
                        <span className={card.withIcon}>
                          <Placeholder size={SMALL_ICON_SIZE} />
                          <span className={card.caption}>{item.location}</span>
                        </span>
                      )}
                      <span className={card.withIcon}>
                        <Placeholder size={SMALL_ICON_SIZE} />
                        <span className={card.caption}>{item.folderName}</span>
                      </span>
                    </span>
                  </span>
                  <Placeholder size={ARROW_ICON_SIZE} />
                </Link>
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </section>
  );
}
