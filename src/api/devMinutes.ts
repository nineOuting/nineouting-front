import { request } from './client';

/** 개발 화면 전용 API. 운영 번들에 들어가지 않도록 DevMinutesPage에서만 쓴다 */

export interface TodaySummary {
  /** 회의 끝 처리가 끝나 저장된 값이면 true. 초안은 이 값이 true여야 만들 수 있다 */
  final: boolean;
  /** 아직 없으면 null */
  todaySummary: unknown;
}

export function getTodaySummary(meetingId: number) {
  return request<TodaySummary>('GET', `/api/meetings/${meetingId}/today-summary`);
}

/** 작성자만 부를 수 있다. 요약이 없으면 409 DRAFT_SOURCE_NOT_READY */
export function requestMinutesDraft(minutesId: number) {
  return request<{ draftStatus: string | null }>('POST', `/api/minutes/${minutesId}/draft`);
}

/** 작업별 AI 호출 기록. halted는 호출 상한이나 연속 실패로 멈췄을 때의 사유다 */
export interface AiWorkInfo {
  calls: number;
  errors: number;
  halted: string | null;
}

export interface AiStatus {
  status: string;
  lastBatch: number;
  received: { batches: number; lines: number; edits: number };
  queued: number;
  errors: number;
  warnings: number;
  /** 실시간 요약의 호출 수만 센다. 다른 작업은 아래 항목의 calls를 본다 */
  llmCalls: number;
  agendaClassification?: AiWorkInfo & { classified: number; pending: number };
  agendaSummary?: AiWorkInfo;
  agendaStatus?: AiWorkInfo;
  agendaOpinions?: AiWorkInfo;
  agendaTodos?: AiWorkInfo;
  agendaOffTopic?: AiWorkInfo;
  agendaTodaySummary?: { built: boolean; agendas: number; decided: number; todos: number; failures: number };
  publisher?: { sent: number; failed: number; retries: number };
}

/** 로컬 전용. vite.config.ts의 프록시로 ai-service를 직접 부른다 (게이트웨이를 거치지 않아 토큰을 보내지 않는다) */
export async function getAiStatus(meetingId: number) {
  const response = await fetch(`/__ai/meetings/${meetingId}/status`);
  if (!response.ok) {
    throw new Error(`ai-service ${response.status} (ai-service를 재시작하면 회의 상태가 사라집니다)`);
  }
  return (await response.json()) as AiStatus;
}
