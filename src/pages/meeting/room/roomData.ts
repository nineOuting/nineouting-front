import type {
  AgendaResponse,
  AgendaStatusCode,
  LiveSummaryResponse,
  MeetingDetailResponse,
  TranscriptLineResponse,
} from '../../../api/meeting';
import type { AgendaStatus, LiveSummary, RoomAgenda, TranscriptLine } from '../../../types/meetingRoom';

// meeting-service 응답을 회의 진행 화면 모양으로 바꾼다

const MS_PER_SECOND = 1000;

const AGENDA_STATUSES: Record<AgendaStatusCode, AgendaStatus> = {
  NOT_STARTED: 'notStarted',
  DISCUSSING: 'discussing',
  DECIDED: 'decided',
  UNDECIDED: 'undecided',
};

/** 결정할 사항별 상태·근거는 안건 보드(2차)가 생기면 받는다. 지금은 논의 전으로 둔다 */
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
  };
}

/** 2026-10-23T14:00:00 (한국 시간, 시간대 없음) → 브라우저 시각 */
function parseServerTime(value: string) {
  return new Date(value).getTime();
}

function formatClock(time: number) {
  const date = new Date(time);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 발언 시각 = 회의 시작 시각 + 음성 시각. 음성 시각에는 멈춘 시간이 빠져 있어
 * 멈췄다 다시 시작한 뒤의 줄은 실제 시각보다 이르게 보인다 (실제 시각은 백엔드가 아직 주지 않는다)
 */
export function toTranscriptLine(line: TranscriptLineResponse, startedAt: string | null): TranscriptLine {
  const base = startedAt ? parseServerTime(startedAt) : Date.now();
  return { seq: line.seq, rev: line.rev, startMs: line.startMs, time: formatClock(base + line.startMs), text: line.text };
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
