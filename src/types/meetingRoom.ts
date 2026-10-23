/** REQ-086 안건 상태: 논의 중 / 논의 전 / 결정 / 미결 */
export type AgendaStatus = 'discussing' | 'notStarted' | 'decided' | 'undecided';

/** REQ-124 결정할 사항 상태: 결정 / 미결 / 논의 전 */
export type DecisionStatus = 'decided' | 'undecided' | 'notDiscussed';

export interface TranscriptLine {
  seq: number;
  /** 같은 seq의 갱신 번호. 더 큰 것만 반영한다 */
  rev: number;
  /** 회의 시작 기준 음성 시각 (ms) */
  startMs: number;
  /** 발언 시각 (HH:mm) */
  time: string;
  text: string;
}

export interface DecisionPoint {
  id: string;
  title: string;
  status: DecisionStatus;
  /** 결정 내용 한 줄 요약 (REQ-124, 126) */
  summary?: string;
  /** 결정 근거 발언의 seq (REQ-125) */
  evidenceSeqs: number[];
}

export interface RoomAgenda {
  id: string;
  title: string;
  status: AgendaStatus;
  decisionPoints: DecisionPoint[];
}

/** REQ-085 실시간 요약. 주요 의견·합의 안 된 부분(REQ-087)은 안건 보드(2차)가 생기면 채운다 */
export interface LiveSummary {
  summary: string[];
  opinions: string[];
  openIssues: string[];
}

/** REQ-091 AI가 제안한 새 안건 */
export interface SuggestedAgenda {
  title: string;
  description: string;
}
