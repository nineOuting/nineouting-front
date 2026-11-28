import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  listNotifications,
  readAllNotifications,
  readNotification,
  type AppNotification,
  type NotificationType,
} from '../api/notification';
import meetingIcon from '../assets/icons/noti-meeting.svg';
import { onSignOut } from '../auth/tokenStore';
import memberIcon from '../assets/icons/noti-member.svg';
import minutesIcon from '../assets/icons/noti-minutes.svg';
import Icon from './Icon';
import Skeleton from './Skeleton';
import type { BackState } from '../utils/meetingFormat';
import styles from './NotificationPanel.module.css';

const ICON_SIZE = 24;
// 처음 열 때(기억한 목록이 없을 때) 그리는 회색 줄 수와 크기 (알림 줄: 아이콘 원 32, 메시지 20, 시간 16).
// 전체 개수는 목록을 받아야 알 수 있어 1줄로 그린다. 더 오면 아래로 늘어나기만 하고 줄어들지 않는다
const SKELETON_ROWS = 1;
const SKELETON_ICON = 32;
const SKELETON_MESSAGE_WIDTH = '80%';
const SKELETON_MESSAGE_HEIGHT = 20;
const SKELETON_TIME_WIDTH = 56;
const SKELETON_TIME_HEIGHT = 16;

/**
 * 마지막으로 받은 알림 목록. 창을 다시 열면 이것부터 바로 보여 주고 뒤에서 새로 받아 바뀐 것만 반영한다
 * (열 때마다 회색 자리를 그렸다가 실제 목록으로 바뀌며 창 높이가 달라지지 않게). 로그아웃하면 지운다
 */
let cachedItems: AppNotification[] | undefined;
onSignOut(() => {
  cachedItems = undefined;
});
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
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<AppNotification[] | undefined>(cachedItems);
  const [error, setError] = useState(false);

  useEffect(() => {
    cachedItems = items;
  }, [items]);

  useEffect(() => {
    let isCurrent = true;
    const hasCached = cachedItems !== undefined;
    listNotifications()
      .then((loaded) => isCurrent && setItems(loaded))
      // 기억한 목록이 있으면 그대로 두고, 처음 열 때만 실패 안내
      .catch(() => isCurrent && !hasCached && setError(true));
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
      // 회의록 확인에서 뒤로 가면 알림을 열었던 화면으로 (SCRUM-366)
      navigate(`/meetings/${item.targetId}`, { state: { backTo: `${location.pathname}${location.search}` } satisfies BackState });
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
        {/* REQ-178 처음 불러오는 동안 회색 자리. 알림 줄과 같은 구조(아이콘, 메시지, 시간)와 높이로 */}
        {!items &&
          !error &&
          Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li key={index} aria-hidden="true">
              <div className={`${styles.item} ${styles.read}`}>
                <Skeleton width={SKELETON_ICON} height={SKELETON_ICON} className={styles.skeletonIcon} />
                <span className={styles.texts}>
                  <Skeleton width={SKELETON_MESSAGE_WIDTH} height={SKELETON_MESSAGE_HEIGHT} />
                  <Skeleton width={SKELETON_TIME_WIDTH} height={SKELETON_TIME_HEIGHT} />
                </span>
              </div>
            </li>
          ))}
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
      {/* 피그마 NotificationPanel Footer RetentionNotice: 알림 14일 보관 안내 */}
      <p className={styles.footer}>알림은 14일 동안 보관되고, 이후 자동으로 삭제돼요.</p>
    </div>
  );
}
