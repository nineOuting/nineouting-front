import type { SuggestedAgenda } from '../types/meetingRoom';

// 새 안건 제안(REQ-091)은 ai-service 안건 보드(2차)가 생기기 전이라 예시 데이터로 띄워 본다 (?demo=suggestion)

export const ROOM_SUGGESTION: SuggestedAgenda = {
  title: '신규 사용자 이탈률 분석',
  description: '신규 유입과 기존 사용자 이탈률을 비교해 개선 우선순위를 정하는 내용이에요.',
};
