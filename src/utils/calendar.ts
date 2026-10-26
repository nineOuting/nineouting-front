// 홈 캘린더 날짜 계산. 주는 월요일에 시작한다 (디자인 MON ~ SUN)

const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Date → 2026-10-26 (로컬 날짜) */
export function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 2026-10-26 → 로컬 자정 Date */
export function fromIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** 그 주의 월요일 */
export function startOfWeek(date: Date) {
  const sinceMonday = (date.getDay() + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;
  return addDays(date, -sinceMonday);
}

/** 월간 보기에 그릴 날: 1일이 든 주의 월요일 ~ 말일이 든 주의 일요일 (최대 42일) */
export function monthGridDays(year: number, month: number) {
  const first = startOfWeek(new Date(year, month, 1));
  const last = new Date(year, month + 1, 0);
  const end = addDays(startOfWeek(last), DAYS_IN_WEEK - 1);
  const count = Math.round((end.getTime() - first.getTime()) / MS_PER_DAY) + 1;
  return Array.from({ length: count }, (_, index) => addDays(first, index));
}

export function weekDays(date: Date) {
  const monday = startOfWeek(date);
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(monday, index));
}

/** 두 날짜(시각 무시) 사이의 날 수. to가 뒤면 양수 */
export function daysBetween(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/** 2026-10-20T14:00:00 → 14:00 */
export function toTime(dateTime: string) {
  return dateTime.slice(11, 16);
}

/** 2026-10-20T14:00:00 → 하루 시작부터 지난 분 */
export function minutesOfDay(dateTime: string) {
  const [hour, minute] = toTime(dateTime).split(':').map(Number);
  return hour * 60 + minute;
}

/** 2026-10-26 → 2026. 10. 26. */
export function formatPeriodDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-');
  return `${year}. ${month}. ${day}.`;
}
