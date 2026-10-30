/** REQ-086 안건 상태: 논의 중 / 논의 전 / 결정 / 미결 / 결정 확인 필요(AI가 결정인지 확신하지 못함) */
export type AgendaStatus = 'discussing' | 'notStarted' | 'decided' | 'undecided' | 'decisionCheck';

/** REQ-124 결정할 사항 상태: 결정 / 미결 / 논의 전 / 결정 확인 필요 */
export type DecisionStatus = 'decided' | 'undecided' | 'notDiscussed' | 'decisionCheck';

export interface TranscriptLine {
  seq: number;
  /** 같은 seq의 갱신 번호. 더 큰 것만 반영한다 */
  rev: number;
  /** 회의 시작 기준 음성 시각 (ms) */
  startMs: number;
  /** 발언 시각 (HH:mm:ss, 회의 경과 시간) */
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
  /** REQ-087 안건 보드의 의견 (주요 의견: 의견·근거, 아직 합의되지 않은 부분: 우려·질문) */
  opinions: string[];
  openIssues: string[];
}

/** REQ-085 실시간 요약. 주요 의견·합의 안 된 부분(REQ-087)은 지금 논의 중인 안건의 안건 보드에서 채운다 */
export interface LiveSummary {
  summary: string[];
  opinions: string[];
  openIssues: string[];
}

/** REQ-091 AI가 제안한 새 안건 */
export interface SuggestedAgenda {
  title: string;
  description?: string;
}
