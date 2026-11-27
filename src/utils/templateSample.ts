import type { TemplateItem } from '../types/template';
import { CELL_SEPARATOR, DEFAULT_COLUMN_NAMES } from './templateSettings';

// 양식 미리보기 (SCRUM-410 디자인 요청): 예시 내용은 비우고 섹션 모양만 보여 준다.
// 양식 편집 미리보기·양식 목록 카드·양식 상세 창이 같이 쓴다

/** 회의 기본 정보: 이름표와 회색 값 안내 (디자인 09 DocInfoList) */
export const SAMPLE_MEETING_INFO = [
  ['일시', '회의 날짜·시간'],
  ['장소', '회의 장소'],
  ['참석자', '참석자 이름'],
];

/** 표 섹션: 머리 행 열 이름과 빈 행 1개 (행 수는 내용에 맞춰 늘어나므로 양식에서는 한 줄만, 디자인 09 11/27) */
export function blankContent(item: TemplateItem) {
  const { table } = item.settings;
  // 열 이름이 있으면 그대로 쓰고, 비운 열(AI가 정함)은 "열 N". 열 이름 없이 저장된 예전 양식만 기본 열 이름 (SCRUM-430)
  const head = Array.from({ length: table.cols }, (_, col) =>
    table.columnNames ? table.columnNames[col]?.trim() || `열 ${col + 1}` : (DEFAULT_COLUMN_NAMES[col] ?? `열 ${col + 1}`),
  );
  const blankRow = Array.from({ length: table.cols }, () => '');
  return [head, blankRow].map((cells) => cells.join(CELL_SEPARATOR)).join('\n');
}
