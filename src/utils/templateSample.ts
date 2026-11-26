import type { TemplateItem } from '../types/template';
import { CELL_SEPARATOR } from './templateSettings';

// 양식 미리보기 (SCRUM-410 디자인 요청): 예시 내용은 비우고 섹션 모양만 보여 준다.
// 양식 편집 미리보기·양식 목록 카드·양식 상세 창이 같이 쓴다
const SAMPLE_TABLE_HEADERS = ['No.', '안건', '논의 내용', '비고'];

/** 회의 기본 정보: 이름표와 회색 값 안내 (디자인 09 DocInfoList) */
export const SAMPLE_MEETING_INFO = [
  ['일시', '회의 날짜·시간'],
  ['장소', '회의 장소'],
  ['참석자', '참석자 이름'],
];

/** 표 섹션: 머리 행 열 이름과 빈 칸 (양식의 행·열 수대로) */
export function blankContent(item: TemplateItem) {
  const { table } = item.settings;
  // 사용자가 정한 열 이름을 먼저 쓰고, 비운 열은 예시 이름 (SCRUM-419)
  const head = Array.from(
    { length: table.cols },
    (_, col) => table.columnNames?.[col]?.trim() || (SAMPLE_TABLE_HEADERS[col] ?? `열 ${col + 1}`),
  );
  const rows = Array.from({ length: Math.max(0, table.rows - 1) }, () => Array.from({ length: table.cols }, () => ''));
  return [head, ...rows].map((cells) => cells.join(CELL_SEPARATOR)).join('\n');
}
