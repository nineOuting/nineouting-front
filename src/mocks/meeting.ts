import type { MinutesTemplate } from '../types/meeting';

// 회의록 양식은 백엔드(minutes-service)에 아직 API가 없어 예시 데이터로 보여 준다 (REQ-100, 123)

export const MINUTES_TEMPLATES: MinutesTemplate[] = [
  { templateId: 'template-basic', name: '기본 회의록', isFavorite: true },
  { templateId: 'template-weekly', name: '주간 회의록', isFavorite: true },
  { templateId: 'template-idea', name: '아이디어 회의록', isFavorite: false },
  { templateId: 'template-retro', name: '회고 회의록', isFavorite: false },
  { templateId: 'template-decision', name: '의사결정 회의록', isFavorite: true },
];
