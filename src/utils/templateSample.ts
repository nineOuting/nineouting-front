import type { TemplateItem } from '../types/template';
import { CELL_SEPARATOR } from './templateSettings';

// 양식 미리보기 (SCRUM-410 디자인 요청): 예시 내용은 비우고 섹션 모양만 보여 준다.
// 양식 편집 미리보기·양식 목록 카드·양식 상세 창이 같이 쓴다
// 디자인 09 11/27 "표 머리글 통일": 모든 섹션이 No. / 항목 / 내용 / 비고
const SAMPLE_TABLE_HEADERS = ['No.', '항목', '내용', '비고'];

/** 회의 기본 정보: 이름표와 회색 값 안내 (디자인 09 DocInfoList) */
export const SAMPLE_MEETING_INFO = [
  ['일시', '회의 날짜·시간'],
  ['장소', '회의 장소'],
  ['참석자', '참석자 이름'],
];

/** 표 섹션: 머리 행 열 이름과 빈 행 1개 (행 수는 내용에 맞춰 늘어나므로 양식에서는 한 줄만, 디자인 09 11/27) */
export function blankContent(item: TemplateItem) {
  const { table } = item.settings;
  // 사용자가 정한 열 이름을 먼저 쓰고, 비운 열은 예시 이름 (SCRUM-419)
  const head = Array.from(
    { length: table.cols },
    (_, col) => table.columnNames?.[col]?.trim() || (SAMPLE_TABLE_HEADERS[col] ?? `열 ${col + 1}`),
  );
  const blankRow = Array.from({ length: table.cols }, () => '');
  return [head, blankRow].map((cells) => cells.join(CELL_SEPARATOR)).join('\n');
}
