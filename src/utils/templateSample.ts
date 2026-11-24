import type { TemplateItem } from '../types/template';
import { CELL_SEPARATOR } from './templateSettings';

// 피그마 프론트 TemplateEditorPage: 양식 미리보기는 실제 회의록처럼 예시 내용으로 채운다.
// 양식 편집 미리보기와 회의 대기 양식 상세 보기가 같이 쓴다
const SAMPLE_TABLE_HEADERS = ['No.', '안건', '논의 내용', '비고'];
const SAMPLE_TABLE_ROWS = [
  ['1', '신규 기능 기획', '주요 기능 범위와 우선순위 논의', '-'],
  ['2', '마케팅 전략', '런칭 일정 및 채널별 전략 논의', '-'],
  ['3', '기타 안건', '추가 논의 사항 정리', '-'],
];
const SAMPLE_TEXT = '신규 기능의 1차 범위와 마케팅 런칭 일정을 확정하기 위한 정기 회의입니다.';
const SAMPLE_LIST = ['신규 기능은 1차 MVP 범위로 우선 개발을 진행한다.', '마케팅 런칭 일정은 11월 첫째 주로 확정한다.'];
const SAMPLE_CHECKLIST = ['기능 기획서 초안 작성 (김민지 · 10/23)', '마케팅 제안서 준비 (이준호 · 10/25)'];

export const SAMPLE_MEETING_INFO = [
  ['일시', '2026. 10. 19 (월) 14:00 – 15:00'],
  ['장소', '회의실 A'],
  ['참석자', '김민지, 이준호, 박서연, 최지호, 김민솔 (5명)'],
];

/** 미리보기 칸 예시 내용 (기록 방식별). 표는 양식의 행, 열 수에 맞춰 자른다 */
export function sampleContent(item: TemplateItem) {
  const { recordType, table } = item.settings;
  if (recordType === 'TABLE') {
    const head = Array.from({ length: table.cols }, (_, col) => SAMPLE_TABLE_HEADERS[col] ?? `열 ${col + 1}`);
    const rows = Array.from({ length: Math.max(0, table.rows - 1) }, (_, row) =>
      Array.from({ length: table.cols }, (_, col) => SAMPLE_TABLE_ROWS[row]?.[col] ?? ''),
    );
    return [head, ...rows].map((cells) => cells.join(CELL_SEPARATOR)).join('\n');
  }
  if (recordType === 'LIST') {
    return SAMPLE_LIST.join('\n');
  }
  if (recordType === 'CHECKLIST') {
    return SAMPLE_CHECKLIST.join('\n');
  }
  return SAMPLE_TEXT;
}
