import type {
  AgendaBoard,
  AgendaResponse,
  AgendaStatusCode,
  LiveSummaryResponse,
  MeetingDetailResponse,
  TranscriptLineResponse,
} from '../../../api/meeting';
import type { AgendaStatus, DecisionStatus, LiveSummary, RoomAgenda, TranscriptLine } from '../../../types/meetingRoom';

// meeting-service 응답을 회의 진행 화면 모양으로 바꾼다

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

const AGENDA_STATUSES: Record<AgendaStatusCode, AgendaStatus> = {
  NOT_STARTED: 'notStarted',
  DISCUSSING: 'discussing',
  DECIDED: 'decided',
  UNDECIDED: 'undecided',
  DECISION_CHECK: 'decisionCheck',
};

// 결정할 사항은 논의 중이 없다 (ai-service agenda-status-contract.md). 혹시 오면 논의 전으로 본다
const DECISION_STATUSES: Record<AgendaStatusCode, DecisionStatus> = {
  NOT_STARTED: 'notDiscussed',
  DISCUSSING: 'notDiscussed',
  DECIDED: 'decided',
  UNDECIDED: 'undecided',
  DECISION_CHECK: 'decisionCheck',
};

// REQ-087 주요 의견은 의견·근거, 아직 합의되지 않은 부분은 우려·질문
const OPEN_ISSUE_KINDS = new Set(['CONCERN', 'QUESTION']);

/** 결정할 사항별 상태·근거는 안건 보드가 오면 applyBoard로 채운다. 그 전에는 논의 전으로 둔다 */
export function toRoomAgenda(agenda: AgendaResponse): RoomAgenda {
  return {
    id: String(agenda.agendaId),
    title: agenda.title,
    status: AGENDA_STATUSES[agenda.status],
    decisionPoints: agenda.decisionPoints.map(({ decisionPointId, text }) => ({
      id: String(decisionPointId),
      title: text,
      status: 'notDiscussed',
      evidenceSeqs: [],
    })),
    opinions: [],
    openIssues: [],
  };
}

/**
 * REQ-086~088, 124~125 안건 보드를 안건 목록에 입힌다. 제목·결정할 사항 문구는 회의 정보 그대로 두고,
 * 상태·결정 내용·근거 발언·의견만 보드에서 가져온다. 보드에 없는 안건(방금 추가한 안건 등)은 그대로 둔다
 */
export function applyBoard(agendas: RoomAgenda[], board: AgendaBoard): RoomAgenda[] {
  const byId = new Map(board.agendas.map((agenda) => [String(agenda.agendaId), agenda]));
  return agendas.map((agenda) => {
    const boardAgenda = byId.get(agenda.id);
    if (!boardAgenda) {
      return agenda;
    }
    const points = new Map((boardAgenda.decisionPoints ?? []).map((point) => [String(point.decisionPointId), point]));
    const opinions = boardAgenda.opinions ?? [];
    return {
      ...agenda,
      status: AGENDA_STATUSES[boardAgenda.status] ?? agenda.status,
      decisionPoints: agenda.decisionPoints.map((decision) => {
        const point = points.get(decision.id);
        if (!point) {
          return decision;
        }
        const status = DECISION_STATUSES[point.status] ?? 'notDiscussed';
        return {
          ...decision,
          status,
          // 논의 전의 문구("아직 논의되지 않았어요")는 보여 주지 않는다
          summary: status === 'notDiscussed' ? undefined : point.decisionText,
          evidenceSeqs: point.evidenceSeqs,
        };
      }),
      opinions: opinions.filter(({ kind }) => !OPEN_ISSUE_KINDS.has(kind)).map(({ text }) => text),
      openIssues: opinions.filter(({ kind }) => OPEN_ISSUE_KINDS.has(kind)).map(({ text }) => text),
    };
  });
}

/** 2026-10-23T14:00:00 (한국 시간, 시간대 없음) → 브라우저 시각 */
function parseServerTime(value: string) {
  return new Date(value).getTime();
}

/** 00:24:18 */
export function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

/**
 * 발언 시각 = 회의 경과 시간 (음성 시각). 음성 시각에는 멈춘 시간이 빠져 있어
 * 회의 시작 시각에 더하면 멈췄다 다시 시작한 뒤의 줄이 이르게 보이므로, 경과 시간 타이머와 같은 기준으로 보여 준다
 */
export function toTranscriptLine(line: TranscriptLineResponse): TranscriptLine {
  const time = formatElapsed(Math.floor(line.startMs / MS_PER_SECOND));
  return { seq: line.seq, rev: line.rev, startMs: line.startMs, time, text: line.text };
}

/** 같은 seq는 통째로 바꾸되, 늦게 온 옛 내용(rev가 더 작은 것)은 버린다 */
export function mergeTranscript(lines: TranscriptLine[], line: TranscriptLine) {
  const existing = lines.find(({ seq }) => seq === line.seq);
  if (existing && existing.rev > line.rev) {
    return lines;
  }
  return [...lines.filter(({ seq }) => seq !== line.seq), line].sort((a, b) => a.startMs - b.startMs);
}

export function removeTranscript(lines: TranscriptLine[], seq: number, rev: number) {
  return lines.filter((line) => line.seq !== seq || line.rev > rev);
}

export function toLiveSummary(response: LiveSummaryResponse | null): LiveSummary | null {
  if (!response || response.summary.length === 0) {
    return null;
  }
  return { summary: response.summary.map(({ text }) => text), opinions: [], openIssues: [] };
}

/** REQ-081 경과 시간 = 지금 - 시작 - 멈춘 시간 (멈춘 동안은 늘지 않는다) */
export function elapsedSecondsOf(detail: MeetingDetailResponse, now: number) {
  if (!detail.startedAt) {
    return 0;
  }
  const until = detail.paused && detail.pausedAt ? parseServerTime(detail.pausedAt) : now;
  const seconds = (until - parseServerTime(detail.startedAt)) / MS_PER_SECOND - detail.pausedSeconds;
  return Math.max(0, Math.floor(seconds));
}
