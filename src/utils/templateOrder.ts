import type { MinutesTemplate } from '../types/meeting';

/**
 * 회의 대기 양식 고르기 창의 순서: 이 워크스페이스에서 정한 양식 → 즐겨찾기 → 나머지 (SCRUM-364).
 * 같은 묶음 안에서는 서버 순서(기본 양식, 내 양식 만든 순, 공유받은 양식)를 그대로 둔다.
 *
 * workspaceTemplateId
 * - number: 워크스페이스가 정한 양식
 * - null: 정하지 않음 → 서비스 기본 양식이 워크스페이스 양식
 * - undefined: 아직 모르거나 불러오지 못함 → 즐겨찾기 → 나머지
 */
export function orderTemplates(templates: MinutesTemplate[], workspaceTemplateId: number | null | undefined) {
  const isWorkspaceTemplate = (template: MinutesTemplate) =>
    workspaceTemplateId === null ? Boolean(template.isDefault) : template.templateId === workspaceTemplateId;
  const rank = (template: MinutesTemplate) => {
    if (isWorkspaceTemplate(template)) {
      return 0;
    }
    return template.isFavorite ? 1 : 2;
  };
  // Array.prototype.sort는 안정 정렬이라 같은 묶음 안의 서버 순서가 유지된다
  return [...templates].sort((a, b) => rank(a) - rank(b));
}
