// meeting-service 결정할 사항 제한과 같다 (2026-10-23 결정: 안건당 최대 5개, 칸당 200자. 기획 확정 전 임시 값)
export const DECISION_POINT_MAX_COUNT = 5;
export const DECISION_POINT_MAX_LENGTH = 200;

/** 빈 칸은 빼고 앞뒤 공백을 지운다 */
export function cleanDecisionPoints(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}
