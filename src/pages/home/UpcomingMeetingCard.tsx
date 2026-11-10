import { Link } from 'react-router-dom';
import { toMember, type MeetingDetailResponse } from '../../api/meeting';
import bulletIcon from '../../assets/icons/bullet.svg';
import chevronRightIcon from '../../assets/icons/chevron-right.svg';
import locationIcon from '../../assets/icons/location.svg';
import scheduleIcon from '../../assets/icons/schedule.svg';
import AvatarStack from '../../components/AvatarStack';
import { daysBetween, fromIsoDate, toTime } from '../../utils/calendar';
import { formatMeetingSchedule } from '../../utils/meetingFormat';
import card from './HomeCard.module.css';
import styles from './UpcomingMeetingCard.module.css';

const ARROW_ICON_SIZE = 20;
const SMALL_ICON_SIZE = 16;
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

/** REQ-148 곧 다가오는 회의: 가장 가까운 예정 회의의 기본 정보, 참여자, 주요 안건 */
export default function UpcomingMeetingCard({ meeting }: UpcomingMeetingCardProps) {
  return (
    <section className={card.card} aria-labelledby="upcoming-title">
      <div className={card.head}>
        <h2 id="upcoming-title" className={card.title}>
          곧 다가오는 회의
        </h2>
        {meeting && (
          <Link to={`/meetings/${meeting.meetingId}`} className={card.iconButton} aria-label={`${meeting.title} 대기 화면으로 이동`}>
            <img src={chevronRightIcon} alt="" width={ARROW_ICON_SIZE} height={ARROW_ICON_SIZE} />
          </Link>
        )}
      </div>
      {meeting === null && (
        <div className={card.empty}>
          <p className={card.emptyTitle}>예정된 회의가 없어요</p>
          <p className={card.emptyCaption}>회의를 만들면 이곳에서 바로 확인할 수 있어요.</p>
        </div>
      )}
      {meeting && (
        <>
          <div className={styles.summary}>
            <div className={styles.titleRow}>
              <span className={styles.title}>{meeting.title}</span>
              <span className={card.badge}>{dDay(meeting.startAt)}</span>
            </div>
            <span className={card.withIcon}>
              <img src={scheduleIcon} alt="" width={SMALL_ICON_SIZE} height={SMALL_ICON_SIZE} />
              <span className={card.secondary}>
                {formatMeetingSchedule(meeting.startAt.slice(0, 10), toTime(meeting.startAt), toTime(meeting.endAt))}
              </span>
            </span>
            {meeting.location && (
              <span className={card.withIcon}>
                <img src={locationIcon} alt="" width={SMALL_ICON_SIZE} height={SMALL_ICON_SIZE} />
                <span className={card.secondary}>{meeting.location}</span>
              </span>
            )}
          </div>
          <div className={styles.people}>
            <AvatarStack
              members={meeting.attendees.map(toMember)}
              max={AVATAR_MAX}
              label={`참여자 ${meeting.attendees.length}명`}
            />
            <span className={card.secondary}>참여자 {meeting.attendees.length}명</span>
          </div>
          {meeting.agendas.length > 0 && (
            <>
              <div className={card.divider} />
              <div className={styles.agendaPreview}>
                <p className={styles.agendaLabel}>주요 안건</p>
                <ul className={styles.agendas}>
                  {meeting.agendas.map((agenda) => (
                    <li key={agenda.agendaId} className={styles.agenda}>
                      <img src={bulletIcon} alt="" width={SMALL_ICON_SIZE} height={SMALL_ICON_SIZE} />
                      <span className={styles.agendaTitle}>{agenda.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
