import { useNavigate } from 'react-router-dom';
import type { MeetingDetailResponse } from '../../api/meeting';
import locationIcon from '../../assets/icons/location.svg';
import scheduleIcon from '../../assets/icons/schedule.svg';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { daysBetween, fromIsoDate, toTime } from '../../utils/calendar';
import { formatMeetingDate } from '../../utils/meetingFormat';
import styles from './UpcomingMeetingCard.module.css';

const SMALL_ICON_SIZE = 16;

interface UpcomingMeetingCardProps {
  /** 가장 가까운 예정 회의. 없으면 null, 불러오는 중이면 undefined */
  meeting: MeetingDetailResponse | null | undefined;
}

/** 오늘이면 D-day, 아니면 D-n */
function dDay(startAt: string) {
  const days = daysBetween(new Date(), fromIsoDate(startAt));
  return days <= 0 ? 'D-day' : `D-${days}`;
}

/** 2026-10-20T14:00 ~ 15:00 → 10.20(화) 14:00 ~ 15:00 */
function schedule(meeting: MeetingDetailResponse) {
  const date = formatMeetingDate(meeting.startAt.slice(0, 10)).slice(5);
  return `${date} ${toTime(meeting.startAt)} ~ ${toTime(meeting.endAt)}`;
}

/**
 * REQ-148 곧 다가오는 회의 (피그마 Page 8 HomePage_v6 UpcomingMeetingCard): 인사 문구 아래 한 줄 띠.
 * 회의명, D-day, 일시, 장소와 [대기실로 이동]
 */
export default function UpcomingMeetingCard({ meeting }: UpcomingMeetingCardProps) {
  const navigate = useNavigate();
  if (meeting === undefined) {
    return null;
  }
  return (
    <section className={styles.card} aria-label="곧 다가오는 회의">
      {meeting === null ? (
        <p className={styles.empty}>예정된 회의가 없어요. 새 회의를 만들면 이곳에서 확인할 수 있어요.</p>
      ) : (
        <>
          <div className={styles.summary}>
            <div className={styles.titleRow}>
              <span className={styles.title}>{meeting.title}</span>
              <span className={styles.badge}>{dDay(meeting.startAt)}</span>
            </div>
            <div className={styles.meta}>
              <span className={styles.metaItem}>
                <Icon src={scheduleIcon} size={SMALL_ICON_SIZE} />
                {schedule(meeting)}
              </span>
              {meeting.location && (
                <span className={styles.metaItem}>
                  <Icon src={locationIcon} size={SMALL_ICON_SIZE} />
                  {meeting.location}
                </span>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            className={styles.go}
            onClick={() => navigate(`/meetings/${meeting.meetingId}`)}
          >
            대기실로 이동
          </Button>
        </>
      )}
    </section>
  );
}
