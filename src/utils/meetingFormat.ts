import type { MeetingStatus } from '../types/meeting';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 2026-10-20 → 2026.10.20(화) */
export function formatMeetingDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${date.replaceAll('-', '.')}(${weekday})`;
}

/** 2026.10.20(화) 14:00 ~ 15:00 */
export function formatMeetingSchedule(date: string, startTime: string, endTime: string) {
  return `${formatMeetingDate(date)} ${startTime} ~ ${endTime}`;
}

/** REQ-019~020 예정된 회의는 대기 화면(진행 중이면 회의방), 끝난 회의는 회의록으로 간다 */
export function meetingPath({ meetingId, status }: { meetingId: number; status: MeetingStatus }) {
  if (status === 'IN_PROGRESS') {
    return `/meetings/${meetingId}/room`;
  }
  return status === 'FINISHED' ? `/meetings/${meetingId}/minutes` : `/meetings/${meetingId}`;
}

/** 2026-10-24T10:00:00 → 2026.10.24 오전 10:00 */
export function formatDateTime(dateTime: string) {
  const hour = Number(dateTime.slice(11, 13));
  const minute = dateTime.slice(14, 16);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${dateTime.slice(0, 10).replaceAll('-', '.')} ${period} ${String(displayHour).padStart(2, '0')}:${minute}`;
}
