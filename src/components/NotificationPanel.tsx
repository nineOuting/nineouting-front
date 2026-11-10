import { useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listNotifications,
  readAllNotifications,
  readNotification,
  type AppNotification,
  type NotificationType,
} from '../api/notification';
import meetingIcon from '../assets/icons/noti-meeting.svg';
import memberIcon from '../assets/icons/noti-member.svg';
import minutesIcon from '../assets/icons/noti-minutes.svg';
import Icon from './Icon';
import Skeleton from './Skeleton';
import styles from './NotificationPanel.module.css';

const ICON_SIZE = 24;
const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_HOURS = 24;

const ICONS: Record<NotificationType, string> = {
  MEMBER_JOIN_REQUESTED: memberIcon,
  MEMBER_JOIN_APPROVED: memberIcon,
  MEETING_INVITED: meetingIcon,
  MEETING_UPDATED: meetingIcon,
  MEETING_CANCELLED: meetingIcon,
  MINUTES_REVIEW_REQUESTED: minutesIcon,
  MINUTES_CONFIRMED: minutesIcon,
  MINUTES_EDITED: minutesIcon,
};

/** 방금, 10분 전, 1시간 전, 어제, 3일 전 */
function timeAgo(createdAt: string) {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / MINUTE_MS);
  if (minutes < 1) {
    return '방금';
  }
  if (minutes < HOUR_MINUTES) {
    return `${minutes}분 전`;
  }
  const hours = Math.floor(minutes / HOUR_MINUTES);
  if (hours < DAY_HOURS) {
    return `${hours}시간 전`;
  }
  const days = Math.floor(hours / DAY_HOURS);
  return days === 1 ? '어제' : `${days}일 전`;
}

interface NotificationPanelProps {
  anchorRef: RefObject<HTMLElement | null>;
  /** 읽음 처리로 안 읽은 개수가 바뀌었을 때 */
  onUnreadChange: (count: number) => void;
  onClose: () => void;
}

/** REQ-004 알림 목록 (디자인 NotificationPanel). 누르면 읽음 처리하고 회의 알림이면 그 회의로 간다 */
export default function NotificationPanel({ anchorRef, onUnreadChange, onClose }: NotificationPanelProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<AppNotification[]>();
  const [error, setError] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    listNotifications()
      .then((loaded) => isCurrent && setItems(loaded))
      .catch(() => isCurrent && setError(true));
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !anchorRef.current?.contains(target)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose]);

  const markRead = (notificationId: number) => {
    const next = items?.map((item) => (item.notificationId === notificationId ? { ...item, read: true } : item));
    setItems(next);
    onUnreadChange(next?.filter((item) => !item.read).length ?? 0);
  };

  const open = (item: AppNotification) => {
    if (!item.read) {
      markRead(item.notificationId);
      void readNotification(item.notificationId).catch(() => undefined);
    }
    if (item.type.startsWith('MEETING_') && item.type !== 'MEETING_CANCELLED' && item.targetId) {
      onClose();
      navigate(`/meetings/${item.targetId}`);
    }
  };

  const readAll = async () => {
    try {
      await readAllNotifications();
      setItems((prev) => prev?.map((item) => ({ ...item, read: true })));
      onUnreadChange(0);
    } catch {
      setError(true);
    }
  };

  return (
    <div ref={panelRef} role="dialog" aria-label="알림" className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.title}>알림</p>
        <button type="button" className={styles.textButton} onClick={readAll} disabled={!items?.some((item) => !item.read)}>
          모두 읽음
        </button>
      </div>
      <ul className={styles.list}>
        {error && <li className={styles.empty}>알림을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</li>}
        {/* REQ-178 불러오는 동안 회색 자리 */}
        {!items && !error && (
          <li className={styles.loading}>
            <Skeleton height={56} />
            <Skeleton height={56} />
          </li>
        )}
        {items?.length === 0 && <li className={styles.empty}>새 알림이 없어요</li>}
        {items?.map((item) => (
          <li key={item.notificationId}>
            <button
              type="button"
              className={[styles.item, item.read ? styles.read : ''].filter(Boolean).join(' ')}
              onClick={() => open(item)}
            >
              <span className={styles.iconWrap}>
                <Icon src={ICONS[item.type]} size={ICON_SIZE} />
              </span>
              <span className={styles.texts}>
                <span className={styles.message}>{item.message}</span>
                <span className={styles.time}>{timeAgo(item.createdAt)}</span>
              </span>
              {!item.read && <span className={styles.unreadDot} aria-label="안 읽음" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
