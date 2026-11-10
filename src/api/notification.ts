import { request } from './client';

/** notification-service NotificationType */
export type NotificationType =
  | 'MEMBER_JOIN_REQUESTED'
  | 'MEMBER_JOIN_APPROVED'
  | 'MEETING_INVITED'
  | 'MEETING_UPDATED'
  | 'MEETING_CANCELLED'
  | 'MINUTES_REVIEW_REQUESTED'
  | 'MINUTES_CONFIRMED'
  | 'MINUTES_EDITED';

export interface AppNotification {
  notificationId: number;
  type: NotificationType;
  message: string;
  workspaceId: number | null;
  /** 회의 알림이면 회의 ID, 회의록 알림이면 회의록 ID */
  targetId: number | null;
  read: boolean;
  createdAt: string;
}

const PAGE_SIZE = 20;

/** REQ-004 내 알림 (최신순) */
export async function listNotifications() {
  const { items } = await request<{ items: AppNotification[]; nextCursor: number | null }>(
    'GET',
    `/api/notifications?size=${PAGE_SIZE}`,
  );
  return items;
}

export async function getUnreadCount() {
  const { count } = await request<{ count: number }>('GET', '/api/notifications/unread-count');
  return count;
}

export function readNotification(notificationId: number) {
  return request('PATCH', `/api/notifications/${notificationId}/read`);
}

export function readAllNotifications() {
  return request('PATCH', '/api/notifications/read-all');
}
