/** REQ-202 프로젝트 색 8가지. 서버는 번호(0~7)만 저장하고 색은 화면이 정한다 */
export const FOLDER_COLORS = [
  { label: '보라', value: '#5e48dd' },
  { label: '파랑', value: '#3965fa' },
  { label: '초록', value: '#27ae36' },
  { label: '주황', value: '#e8590c' },
  { label: '빨강', value: '#de2021' },
  { label: '청록', value: '#0ca678' },
  { label: '분홍', value: '#d6336c' },
  { label: '회색', value: '#6b7280' },
] as const;

/** 번호가 없으면(예전 응답) 첫 색 */
export function folderColor(index?: number | null) {
  return FOLDER_COLORS[(index ?? 0) % FOLDER_COLORS.length].value;
}
