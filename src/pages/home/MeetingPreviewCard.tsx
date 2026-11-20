import { useEffect, useRef, useState } from 'react';
import { getMeetingDetail, toMember, type CalendarMeeting, type MeetingDetailResponse } from '../../api/meeting';
import closeIcon from '../../assets/icons/close-sm.svg';
import folderIcon from '../../assets/icons/folder-meta.svg';
import locationIcon from '../../assets/icons/location.svg';
import scheduleIcon from '../../assets/icons/schedule.svg';
import AvatarStack from '../../components/AvatarStack';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { folderIconColor } from '../../utils/folderColor';
import styles from './MeetingPreviewCard.module.css';

const ICON_SIZE = 16;
const META_ICON_SIZE = 20;
const CARD_WIDTH = 320;
const GAP_PX = 8;
const AVATAR_MAX = 4;

interface MeetingPreviewCardProps {
  meeting: CalendarMeeting;
  /** 누른 일정 칸의 위치. 카드를 그 옆에 둔다 */
  anchor: DOMRect;
  /** REQ-202 프로젝트 색 번호. 폴더 아이콘 색 */
  folderColor?: number | null;
  onOpen: () => void;
  onClose: () => void;
}

type PreviewState = 'scheduled' | 'missed' | 'live' | 'ended';

/** 디자인 MeetingPreviewCard: 위 상태 배지, 아래 버튼 이름이 회의 상태를 따른다 (디자인 체크 2026-11-19) */
const STATE_LABELS: Record<PreviewState, { badge: string; action: string }> = {
  scheduled: { badge: '회의 예정', action: '대기실로 이동' },
  missed: { badge: '지난 회의', action: '회의 보기' },
  live: { badge: '회의 진행 중', action: '회의실로 이동' },
  ended: { badge: '회의 끝남', action: '회의록 보기' },
};

function previewState(meeting: CalendarMeeting): PreviewState {
  if (meeting.status === 'IN_PROGRESS') {
    return 'live';
  }
  if (meeting.status === 'FINISHED') {
    return 'ended';
  }
  return new Date(meeting.endAt).getTime() < Date.now() ? 'missed' : 'scheduled';
}

function timeOf(dateTime: string) {
  return dateTime.slice(11, 16);
}

/** 디자인: 10월 20일(화) */
function dateOf(dateTime: string) {
  const date = new Date(dateTime);
  const day = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일(${day})`;
}

/**
 * REQ-019 캘린더의 회의를 누르면 보이는 미리보기 카드 (디자인 HomeMeetingPreviewPage):
 * 회의명, 일시, 장소, 폴더, 참석자와 [회의 열기]
 */
export default function MeetingPreviewCard({ meeting, anchor, folderColor, onOpen, onClose }: MeetingPreviewCardProps) {
  const state = previewState(meeting);
  const [detail, setDetail] = useState<MeetingDetailResponse | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCurrent = true;
    getMeetingDetail(meeting.meetingId)
      .then((found) => isCurrent && setDetail(found))
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [meeting.meetingId]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!cardRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // 오른쪽에 자리가 없으면 왼쪽에 둔다
  const fitsRight = anchor.right + GAP_PX + CARD_WIDTH < window.innerWidth;
  const left = fitsRight ? anchor.right + GAP_PX : Math.max(GAP_PX, anchor.left - GAP_PX - CARD_WIDTH);
  const top = Math.min(anchor.top, window.innerHeight - 320);

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`${meeting.title} 미리보기`}
      className={styles.card}
      style={{ left, top: Math.max(GAP_PX, top), width: CARD_WIDTH }}
    >
      <div className={styles.head}>
        <span className={`${styles.badge} ${styles[state]}`}>{STATE_LABELS[state].badge}</span>
        <button type="button" className={styles.close} aria-label="미리보기 닫기" onClick={onClose}>
          <Icon src={closeIcon} size={ICON_SIZE} />
        </button>
      </div>
      <p className={styles.title}>{meeting.title}</p>
      <ul className={styles.meta}>
        <li>
          <Icon src={scheduleIcon} size={META_ICON_SIZE} className={styles.icon} />
          {dateOf(meeting.startAt)} {timeOf(meeting.startAt)} – {timeOf(meeting.endAt)}
        </li>
        {detail?.location && (
          <li>
            <Icon src={locationIcon} size={META_ICON_SIZE} className={styles.icon} />
            {detail.location}
          </li>
        )}
        <li>
          <span className={styles.folderIcon} style={{ color: folderIconColor(folderColor) }}>
            <Icon src={folderIcon} size={META_ICON_SIZE} />
          </span>
          {meeting.workspaceName} / {meeting.folderName}
        </li>
      </ul>
      {detail && (
        <AvatarStack members={detail.attendees.map(toMember)} max={AVATAR_MAX} label={`참석자 ${detail.attendees.length}명`} />
      )}
      <Button variant="secondary" size="md" block onClick={onOpen}>
        {STATE_LABELS[state].action}
      </Button>
    </div>
  );
}
