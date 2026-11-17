/**
 * REQ-202 프로젝트 색 8가지 (피그마 ProjectColorPicker 순서). 서버는 번호(0~7)만 저장하고 색은 화면이 정한다.
 * 값은 index.css의 --project-{key}-default / -subtle / -icon 토큰
 */
export const FOLDER_COLORS = [
  { key: 'red', label: '빨강' },
  { key: 'orange', label: '주황' },
  { key: 'yellow', label: '노랑' },
  { key: 'green', label: '초록' },
  { key: 'pink', label: '분홍' },
  { key: 'purple', label: '보라' },
  { key: 'indigo', label: '남색' },
  { key: 'sky', label: '하늘' },
] as const;

function keyOf(index?: number | null) {
  return FOLDER_COLORS[(index ?? 0) % FOLDER_COLORS.length].key;
}

/** 스와치, 달력 왼쪽 줄, 점 */
export function folderColor(index?: number | null) {
  return `var(--project-${keyOf(index)}-default)`;
}

/** 아이콘 바탕, 달력 일정 바탕 */
export function folderSubtleColor(index?: number | null) {
  return `var(--project-${keyOf(index)}-subtle)`;
}

/** 폴더 아이콘 색 */
export function folderIconColor(index?: number | null) {
  return `var(--project-${keyOf(index)}-icon)`;
}

/** 폴더 카드 테두리, 나눔 줄 */
export function folderBorderColor(index?: number | null) {
  return `var(--project-${keyOf(index)}-border)`;
}
