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
