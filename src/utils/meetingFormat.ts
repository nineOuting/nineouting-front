import type { MeetingStatus } from '../types/meeting';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 2026-10-20 → 2026.10.20(화) */
export function formatMeetingDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${date.replaceAll('-', '.')}(${weekday})`;
}

/** 2026-10-20T14:52:10 → 10.20(화) 14:52 */
export function formatShortDateTime(dateTime: string) {
  return `${formatMeetingDate(dateTime.slice(0, 10)).slice(5)} ${dateTime.slice(11, 16)}`;
}

/** 2026.10.20(화) 14:00 ~ 15:00 */
export function formatMeetingSchedule(date: string, startTime: string, endTime: string) {
  return `${formatMeetingDate(date)} ${startTime} ~ ${endTime}`;
}

/** REQ-019~020 진행 중이면 회의방, 아니면 대기 화면 (끝난 회의는 대기 화면이 회의록 확인 화면으로 바뀌어 있다) */
export function meetingPath({ meetingId, status }: { meetingId: number; status: MeetingStatus }) {
  if (status === 'IN_PROGRESS') {
    return `/meetings/${meetingId}/room`;
  }
  // REQ-175 끝난 회의도 대기 화면 주소로 간다 (회의록 확인 화면으로 바뀌어 있다)
  return `/meetings/${meetingId}`;
}

/** 2026-10-24T10:00:00 → 2026.10.24 오전 10:00 */
export function formatDateTime(dateTime: string) {
  const hour = Number(dateTime.slice(11, 13));
  const minute = dateTime.slice(14, 16);
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${dateTime.slice(0, 10).replaceAll('-', '.')} ${period} ${String(displayHour).padStart(2, '0')}:${minute}`;
}

/**
 * 회의·회의록 화면으로 갈 때 넘기는 "돌아갈 곳". 회의록 확인 화면의 뒤로 가기가 이 주소로 간다
 * (홈, 아카이브, 워크스페이스, 알림에서 들어오면 그 화면으로. 없으면 회의의 프로젝트 폴더로) (SCRUM-366)
 */
export interface BackState {
  backTo?: string;
}

/** location.state에서 돌아갈 곳을 꺼낸다. 앱 안의 주소(/로 시작)만 받는다 */
export function backToOf(state: unknown) {
  const backTo = (state as BackState | null)?.backTo;
  return typeof backTo === 'string' && backTo.startsWith('/') && !backTo.startsWith('//') ? backTo : undefined;
}
