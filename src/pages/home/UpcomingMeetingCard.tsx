import { Link } from 'react-router-dom';
import { toMember, type MeetingDetailResponse } from '../../api/meeting';
import dividerHomeCard from '../../assets/divider-home-card.svg';
import AvatarStack from '../../components/AvatarStack';
import Placeholder from '../../components/Placeholder';
import { daysBetween, fromIsoDate, toTime } from '../../utils/calendar';
import { formatMeetingSchedule } from '../../utils/meetingFormat';
import card from './HomeCard.module.css';
import styles from './UpcomingMeetingCard.module.css';

const ICON_SIZE = 26;
const SMALL_ICON_SIZE = 16;
const EMPTY_ICON_SIZE = 35;
const DIVIDER_WIDTH = 249;
const AVATAR_MAX = 4;

interface UpcomingMeetingCardProps {
  /** 가장 가까운 예정 회의. 없으면 null, 불러오는 중이면 undefined */
  meeting: MeetingDetailResponse | null | undefined;
}

/** 오늘이면 D-day, 아니면 D-n */
function dDay(startAt: string) {
  const days = daysBetween(new Date(), fromIsoDate(startAt));
  return days <= 0 ? 'D-day' : `D-${days}`;
}

/** REQ-141 곧 다가오는 회의: 가장 가까운 예정 회의의 기본 정보·참여자·주요 안건 */
export default function UpcomingMeetingCard({ meeting }: UpcomingMeetingCardProps) {
  return (
    <section className={`${card.card} ${styles.card}`} aria-labelledby="upcoming-title">
      <div className={card.head}>
        <h2 id="upcoming-title" className={card.title}>
          <Placeholder size={ICON_SIZE} />곧 다가오는 회의
        </h2>
        {meeting && (
          <Link to={`/meetings/${meeting.meetingId}`} className={card.iconButton} aria-label={`${meeting.title} 대기 화면으로 이동`}>
            <Placeholder size={ICON_SIZE} />
          </Link>
        )}
      </div>
      <img src={dividerHomeCard} alt="" width={DIVIDER_WIDTH} height={1} className={card.divider} />
      {meeting === null && (
        <div className={card.empty}>
          <Placeholder size={EMPTY_ICON_SIZE} />
          <p className={card.emptyTitle}>예정된 회의가 없어요</p>
          <p className={card.emptyCaption}>회의를 만들면 이곳에서 바로 확인할 수 있어요.</p>
        </div>
      )}
      {meeting && (
        <>
          <div className={styles.titleRow}>
            <span className={card.body}>{meeting.title}</span>
            <span className={card.badge}>{dDay(meeting.startAt)}</span>
          </div>
          <p className={card.body}>기본 정보</p>
          <div className={styles.infoRow}>
            <span className={card.caption}>
              {formatMeetingSchedule(meeting.startAt.slice(0, 10), toTime(meeting.startAt), toTime(meeting.endAt))}
            </span>
            {meeting.location && (
              <span className={card.withIcon}>
                <Placeholder size={SMALL_ICON_SIZE} />
                <span className={card.caption}>{meeting.location}</span>
              </span>
            )}
          </div>
          <div className={styles.people}>
            <span className={card.caption}>참여자 {meeting.attendees.length}명</span>
            <AvatarStack
              members={meeting.attendees.map(toMember)}
              max={AVATAR_MAX}
              size="large"
              label={`참여자 ${meeting.attendees.length}명`}
            />
          </div>
          <p className={card.body}>주요 안건</p>
          <ul className={styles.agendas}>
            {meeting.agendas.map((agenda) => (
              <li key={agenda.agendaId} className={card.withIcon}>
                <Placeholder size={SMALL_ICON_SIZE} />
                <span className={`${card.caption} ${styles.agendaTitle}`}>{agenda.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
