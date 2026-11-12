import type { Agenda, Meeting, MeetingStatus, Member, PendingAgenda } from '../types/meeting';
import type { FolderMeeting, FolderMeetingStatus, FolderPendingAgenda } from '../types/workspace';
import { putToStorage, request } from './client';

// meeting-service API (docs/services/meeting-service.md). 시각은 한국 시간 LocalDateTime 문자열(2026-10-20T14:00:00)

export const MEETING_ERROR_CODES = {
  alreadyStarted: 'MEETING_ALREADY_STARTED',
} as const;

const UNKNOWN_USER_NAME = '알 수 없는 사용자';

interface PersonResponse {
  userId: number;
  /** 탈퇴 등으로 user-service에 없으면 null */
  name: string | null;
  profileImageUrl: string | null;
}

export type AgendaStatusCode = 'NOT_STARTED' | 'DISCUSSING' | 'DECIDED' | 'UNDECIDED' | 'DECISION_CHECK';

export interface AgendaResponse {
  agendaId: number;
  position: number;
  title: string;
  /** decisionPointId는 안건 보드(ai-service)가 가리키는 번호 */
  decisionPoints: { decisionPointId: number; position: number; text: string }[];
  status: AgendaStatusCode;
  pendingAgendaId: number | null;
  addedDuringMeeting: boolean;
}

export interface MeetingDetailResponse {
  meetingId: number;
  workspaceId: number;
  folderId: number;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  status: MeetingStatus;
  owner: PersonResponse;
  writer: PersonResponse;
  attendees: PersonResponse[];
  agendas: AgendaResponse[];
  previousMeetingId: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  paused: boolean;
  pausedAt: string | null;
  pausedSeconds: number;
  /** REQ-123 대기 화면에서 고른 회의록 양식 */
  templateId: number | null;
}

type MinutesProgress = 'REVIEWING' | 'CONFIRMED';

interface MeetingSummaryResponse {
  meetingId: number;
  title: string;
  startAt: string;
  endAt: string;
  status: MeetingStatus;
  /** 검토 요청 전이면 null */
  minutesStatus: MinutesProgress | null;
  writer: PersonResponse;
  attendees: PersonResponse[];
}

interface MeetingPageResponse {
  items: MeetingSummaryResponse[];
  totalCount: number;
  hasNext: boolean;
}

// meeting-service 목록 한 번에 받을 수 있는 최대 개수
const FOLDER_MEETING_PAGE_SIZE = 100;

interface PendingAgendaResponse {
  pendingAgendaId: number;
  title: string;
  decisionPoints: string[];
  fromMeetingTitle: string;
  carriedAt: string;
  takenMeetingId: number | null;
}

interface MeetingRequest {
  title: string;
  startAt: string;
  endAt: string;
  location: string;
  attendeeUserIds: number[];
  writerUserId?: number;
  agendas: { title: string; decisionPoints: string[]; pendingAgendaId?: number }[];
}

export interface TranscriptLineResponse {
  seq: number;
  rev: number;
  text: string;
  startMs: number;
  final: boolean;
}

export interface LiveSummaryResponse {
  version: number;
  summary: { text: string; topic: string | null }[];
}

interface TicketResponse {
  ticket: string;
}

/** 안건 보드 (ai-service docs/api/agenda-*.md). meeting-service가 ai-service가 보낸 JSON을 그대로 준다 */
export interface BoardDecisionPoint {
  decisionPointId: number;
  status: AgendaStatusCode;
  /** 결정 내용 (결정), 결정 후보 (결정 확인 필요), 아직 정해지지 않은 내용 (미결) */
  decisionText: string;
  evidenceSeqs: number[];
  edited: boolean;
  needsCheck: boolean;
  /** 사용자가 상태를 직접 정함 (agenda-status-contract.md v0.3 7.5). 예전 ai-service는 보내지 않는다 */
  statusEdited?: boolean;
}

export interface BoardOpinion {
  id: string;
  text: string;
  kind: 'OPINION' | 'EVIDENCE' | 'CONCERN' | 'QUESTION';
  evidenceSeqs: number[];
}

/** REQ-085 안건 요약 문장 (ai-service 안건 보드) */
export interface BoardSummarySentence {
  id: string;
  text: string;
  evidenceSeqs: number[];
}

/** REQ-097 할 일·담당자 (ai-service 안건 보드). 담당자를 참석자와 맞추지 못하면 assigneeUserId가 null */
export interface BoardTodo {
  id: string;
  task: string;
  assigneeName: string | null;
  assigneeStatus: 'MATCHED' | 'UNASSIGNED' | 'NOT_IN_ROSTER' | 'AMBIGUOUS' | null;
  assigneeUserId: number | null;
  dueText: string | null;
  evidenceSeqs: number[];
}

export interface BoardAgenda {
  agendaId: number;
  status: AgendaStatusCode;
  summary?: BoardSummarySentence[];
  decisionPoints?: BoardDecisionPoint[];
  opinions?: BoardOpinion[];
  todos?: BoardTodo[];
}

/**
 * REQ-093~097 [회의 끝내기]를 누른 뒤 보드에 오는 값. 끝내기 요청이 없거나 [이어서 논의하기]로 취소되면 null.
 * leftover: 결론이 나지 않은 안건 목록 (비면 바로 오늘 회의 요약, REQ-096), todaySummary: 오늘 회의 요약 (안건별)
 */
export interface BoardEndSnapshot {
  final: boolean;
  agendas: BoardAgenda[];
}

/** REQ-091 SUGGEST: 새 안건 등록 제안, REQ-092 LONG: 등록되지 않은 주제가 이어짐 */
export interface BoardOffTopic {
  stage: 'SUGGEST' | 'LONG';
  detectedAt: string;
  suggestedTitle: string | null;
  evidenceSeqs: number[];
}

export interface AgendaBoard {
  version: number;
  currentAgendaId: number | null;
  agendas: BoardAgenda[];
  offTopic: BoardOffTopic | null;
  leftover?: BoardEndSnapshot | null;
  todaySummary?: BoardEndSnapshot | null;
}

/** REQ-089 전사 줄의 안건. agendaId가 null이면 해당 없음, corrected는 작성자가 고친 줄 */
export interface LineAgendaResponse {
  seq: number;
  agendaId: number | null;
  corrected: boolean;
}

/** 회의방 WebSocket agendaClassification: 자동 분류가 바뀐 줄 */
export interface AgendaClassificationMessage {
  version: number;
  currentAgendaId: number | null;
  final: boolean;
  lines: { seq: number; agendaId: number | null }[];
}

interface AgendaBoardResponse {
  meetingId: number;
  version: number;
  currentAgendaId: number | null;
  /** 아직 보드가 오지 않았으면 null */
  board: AgendaBoard | null;
}

export function toMember(person: PersonResponse): Member {
  return {
    userId: person.userId,
    name: person.name ?? UNKNOWN_USER_NAME,
    profileImageUrl: person.profileImageUrl ?? undefined,
  };
}

/** 2026-10-20T14:00:00 → 2026.10.20 */
export function toDisplayDate(dateTime: string) {
  return dateTime.slice(0, 10).replaceAll('-', '.');
}

function toAgenda(agenda: AgendaResponse): Agenda {
  return {
    id: String(agenda.agendaId),
    title: agenda.title,
    decisionPoints: agenda.decisionPoints.map(({ text }) => text),
    pendingAgendaId: agenda.pendingAgendaId ?? undefined,
  };
}

export function toMeeting(detail: MeetingDetailResponse): Meeting {
  return {
    meetingId: detail.meetingId,
    folderId: detail.folderId,
    status: detail.status,
    title: detail.title,
    date: detail.startAt.slice(0, 10),
    startTime: detail.startAt.slice(11, 16),
    endTime: detail.endAt.slice(11, 16),
    location: detail.location ?? '',
    attendees: detail.attendees.map(toMember),
    agendas: detail.agendas.map(toAgenda),
    writer: toMember(detail.writer),
    templateId: detail.templateId ?? undefined,
    materials: [],
  };
}

function toRequest(meeting: Omit<Meeting, 'meetingId' | 'folderId' | 'status'>): MeetingRequest {
  return {
    title: meeting.title,
    startAt: `${meeting.date}T${meeting.startTime}:00`,
    endAt: `${meeting.date}T${meeting.endTime}:00`,
    location: meeting.location,
    attendeeUserIds: meeting.attendees.map(({ userId }) => userId),
    writerUserId: meeting.writer?.userId,
    agendas: meeting.agendas.map(({ title, decisionPoints, pendingAgendaId }) => ({ title, decisionPoints, pendingAgendaId })),
  };
}

/** REQ-059~063, 065~071 회의 생성 */
export async function createMeeting(folderId: number, meeting: Omit<Meeting, 'meetingId' | 'folderId' | 'status'>) {
  return toMeeting(await request<MeetingDetailResponse>('POST', `/api/folders/${folderId}/meetings`, toRequest(meeting)));
}

/** REQ-074~075 회의 대기 화면, REQ-081 회의 진행 화면 */
export function getMeetingDetail(meetingId: number | string) {
  return request<MeetingDetailResponse>('GET', `/api/meetings/${meetingId}`);
}

/** REQ-064 회의 정보 수정 (참석자 모두, 시작 전에만). 안건·참석자·회의록 작성자도 통째로 바꾼다 */
export async function updateMeeting(meeting: Meeting) {
  return toMeeting(await request<MeetingDetailResponse>('PUT', `/api/meetings/${meeting.meetingId}`, toRequest(meeting)));
}

/** REQ-123 회의록 양식 고르기 (참석자, 시작 전). 회의를 마무리하면 이 양식으로 회의록을 만든다. null이면 뺀다 */
export async function chooseMeetingTemplate(meetingId: number, templateId: number | null) {
  return toMeeting(await request<MeetingDetailResponse>('PUT', `/api/meetings/${meetingId}/template`, { templateId }));
}

/** REQ-073 회의 취소 */
export function cancelMeeting(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/cancel`);
}

export interface MeetingMaterial {
  materialId: number;
  fileName: string;
  contentType: string;
  size: number;
  uploadedBy: PersonResponse;
  uploadedAt: string;
  /** 1시간 동안 쓸 수 있는 내려받기 주소 */
  downloadUrl: string;
}

/** REQ-067 사전 자료 목록 (다 올라간 것만) */
export function listMaterials(meetingId: number) {
  return request<MeetingMaterial[]>('GET', `/api/meetings/${meetingId}/materials`);
}

/**
 * REQ-067 사전 자료 올리기: 업로드 주소 받기 → 브라우저가 저장소(S3)에 바로 올리기 → 다 올렸다고 알리기.
 * 서버가 실제 크기를 다시 확인한다 (50MB 이하)
 */
export async function uploadMaterial(meetingId: number, file: File) {
  const contentType = file.type || 'application/octet-stream';
  const { materialId, uploadUrl } = await request<{ materialId: number; uploadUrl: string }>(
    'POST',
    `/api/meetings/${meetingId}/materials`,
    { fileName: file.name, contentType, size: file.size },
  );
  await putToStorage(uploadUrl, file, contentType);
  return request<MeetingMaterial>('POST', `/api/meetings/${meetingId}/materials/${materialId}/complete`);
}

/** REQ-067 사전 자료 지우기 (올린 사람, 회의를 만든 사람) */
export function deleteMaterial(meetingId: number, materialId: number) {
  return request('DELETE', `/api/meetings/${meetingId}/materials/${materialId}`);
}

/** REQ-166 다른 폴더로 이동 (회의를 만든 사람). 회의록도 따라간다 */
export function moveMeeting(meetingId: number, folderId: number) {
  return request('PUT', `/api/meetings/${meetingId}/folder`, { folderId });
}

/** REQ-166 회의 삭제: 쓰레기통으로 (회의를 만든 사람, 진행 중이면 안 된다). 회의록도 숨는다 */
export function trashMeeting(meetingId: number) {
  return request('DELETE', `/api/meetings/${meetingId}`);
}

/** REQ-143 복구, REQ-166 [되돌리기] */
export function restoreMeeting(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/restore`);
}

/** REQ-143 영구 삭제 */
export function purgeMeeting(meetingId: number) {
  return request('DELETE', `/api/meetings/${meetingId}/purge`);
}

export interface TrashMeeting {
  meetingId: number;
  title: string;
  folderId: number;
  folderName: string;
  startAt: string;
  /** 회의가 끝나 회의록이 있는지 */
  hasMinutes: boolean;
  deletedBy: PersonResponse;
  deletedAt: string;
  purgeAt: string;
}

/** REQ-143 쓰레기통의 회의 (내가 지웠거나 내가 만든 회의) */
export function listTrashMeetings(workspaceId: number) {
  return request<TrashMeeting[]>('GET', `/api/meetings/trash?workspaceId=${workspaceId}`);
}

export type AiFeedbackTarget = 'LIVE_SUMMARY' | 'DECISION_EVIDENCE' | 'MINUTES_DRAFT';
export type AiFeedbackRating = 'ACCURATE' | 'NEEDS_FIX';

/** REQ-172 [정확해요], [고칠 부분 있어요]. 같은 자리에 다시 누르면 바뀐다 */
export function sendAiFeedback(meetingId: number, target: AiFeedbackTarget, rating: AiFeedbackRating) {
  return request('PUT', `/api/meetings/${meetingId}/ai-feedback`, { target, rating });
}

/** REQ-063 같은 폴더의 지난 회의 (시작 시각 최신순, 취소된 회의 제외) */
export async function listFolderMeetings(folderId: number, size: number) {
  const page = await request<MeetingPageResponse>('GET', `/api/folders/${folderId}/meetings?page=0&size=${size}`);
  return page.items;
}

/** REQ-048 목록의 상태: 회의 상태 + 회의록 상태 (끝났는데 검토 요청 전이면 작성 중) */
function toFolderMeetingStatus(status: MeetingStatus, minutesStatus: MinutesProgress | null): FolderMeetingStatus {
  if (status === 'SCHEDULED') {
    return 'scheduled';
  }
  if (status === 'IN_PROGRESS') {
    return 'inProgress';
  }
  if (minutesStatus === 'CONFIRMED') {
    return 'confirmed';
  }
  return minutesStatus === 'REVIEWING' ? 'reviewing' : 'writing';
}

/** REQ-048 폴더 안의 회의 (날짜 최신순, 취소된 회의 제외) */
export async function listFolderMeetingRows(folderId: number): Promise<FolderMeeting[]> {
  const page = await request<MeetingPageResponse>(
    'GET',
    `/api/folders/${folderId}/meetings?page=0&size=${FOLDER_MEETING_PAGE_SIZE}`,
  );
  return page.items.map((item) => ({
    meetingId: item.meetingId,
    title: item.title,
    date: item.startAt.slice(0, 10),
    status: toFolderMeetingStatus(item.status, item.minutesStatus),
    writer: toMember(item.writer),
    attendees: item.attendees.map(toMember),
  }));
}

/** REQ-037 폴더 카드의 "회의 N개" (목록의 전체 개수만 받는다) */
export async function countFolderMeetings(folderId: number) {
  return (await request<MeetingPageResponse>('GET', `/api/folders/${folderId}/meetings?page=0&size=1`)).totalCount;
}

/** REQ-051 폴더 화면의 남은 안건 (다른 회의가 불러간 안건은 빠진다) */
export async function listFolderPendingAgendas(folderId: number): Promise<FolderPendingAgenda[]> {
  const items = await request<PendingAgendaResponse[]>('GET', `/api/folders/${folderId}/pending-agendas`);
  return items.map(({ pendingAgendaId, title, fromMeetingTitle, carriedAt }) => ({
    pendingAgendaId,
    title,
    fromMeetingTitle,
    carriedAt: carriedAt.slice(0, 10),
  }));
}

/** REQ-051~052, 068 폴더의 남은 안건 */
export async function listPendingAgendas(folderId: number): Promise<PendingAgenda[]> {
  const items = await request<PendingAgendaResponse[]>('GET', `/api/folders/${folderId}/pending-agendas`);
  return items.map((item) => ({
    id: item.pendingAgendaId,
    title: item.title,
    decisionPoints: item.decisionPoints,
    carriedOverFrom: toDisplayDate(item.carriedAt),
    takenMeetingId: item.takenMeetingId ?? undefined,
  }));
}

/** REQ-076 회의 시작 (회의록 작성자) */
export function startMeeting(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/start`);
}

/** REQ-098 회의 마무리 (회의록 작성자, 진행 중에만). 녹음을 끝내고 회의록을 만든다 */
export function finishMeeting(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/finish`);
}

/** REQ-084 회의 멈춤·재개 (회의록 작성자) */
export function pauseMeeting(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/pause`);
}

export function resumeMeeting(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/resume`);
}

/** REQ-090 회의 도중 안건 추가 (회의록 작성자). 결정할 사항은 1개 이상 */
/** REQ-173 회의 중 안건 이름 고치기 (회의록 작성자) */
export function renameMeetingAgenda(meetingId: number, agendaId: number, title: string) {
  return request<AgendaResponse>('PUT', `/api/meetings/${meetingId}/agendas/${agendaId}`, { title });
}

/** REQ-173 회의 중 안건 삭제 (회의록 작성자, 1개는 남긴다) */
export function deleteMeetingAgenda(meetingId: number, agendaId: number) {
  return request('DELETE', `/api/meetings/${meetingId}/agendas/${agendaId}`);
}

export function addMeetingAgenda(meetingId: number, title: string, decisionPoints: string[]) {
  return request<AgendaResponse>('POST', `/api/meetings/${meetingId}/agendas`, { title, decisionPoints });
}

/** REQ-079 지금까지의 전사 텍스트 */
export function listTranscripts(meetingId: number) {
  return request<TranscriptLineResponse[]>('GET', `/api/meetings/${meetingId}/transcripts`);
}

/** REQ-083 전사 텍스트 수정 (회의록 작성자) */
export function editTranscript(meetingId: number, seq: number, text: string) {
  return request<TranscriptLineResponse>('PATCH', `/api/meetings/${meetingId}/transcripts/${seq}`, { text });
}

/** REQ-085~088, 124~125 지금 안건 보드. 아직 없으면 null */
export async function getAgendaBoard(meetingId: number) {
  return (await request<AgendaBoardResponse>('GET', `/api/meetings/${meetingId}/agenda-board`)).board;
}

/** REQ-126 결정 내용 수정 (회의록 작성자, 진행 중). ai-service로 보내고 고친 보드가 회의방으로 다시 온다 */
export function editDecision(meetingId: number, agendaId: number, decisionPointId: number, decisionText: string,
  evidenceSeqs: number[]) {
  return request('PUT', `/api/meetings/${meetingId}/agendas/${agendaId}/decision-points/${decisionPointId}/decision`,
    { decisionText, evidenceSeqs });
}

/** 사용자가 정하는 결정할 사항 상태. AUTO는 사용자가 정한 상태를 풀고 AI 판정으로 돌아간다 */
export type DecisionStatusEdit = 'DECIDED' | 'UNDECIDED' | 'AUTO';

/** 결정할 사항 상태 정하기 (회의록 작성자, 진행 중). 정한 상태는 AI가 전사로 바꾸지 않는다 */
export function setDecisionStatus(meetingId: number, agendaId: number, decisionPointId: number, status: DecisionStatusEdit) {
  return request('PUT', `/api/meetings/${meetingId}/agendas/${agendaId}/decision-points/${decisionPointId}/status`, { status });
}

/** 안건 전체를 결정으로, 미결로 (그 안건의 결정할 사항마다 정한다) */
export function setAgendaDecisionStatus(meetingId: number, agendaId: number, status: DecisionStatusEdit) {
  return request('PUT', `/api/meetings/${meetingId}/agendas/${agendaId}/decision-status`, { status });
}

/** REQ-085 요약 문장, REQ-097 할 일 고치기 (회의록 작성자, 진행 중). 근거는 보드에서 받은 그대로 */
export function editAgendaItem(
  meetingId: number,
  target: 'summary' | 'todos',
  itemId: string,
  body: {
    agendaId: number;
    evidenceSeqs: number[];
    text?: string;
    task?: string;
    assigneeName?: string | null;
    assigneeUserId?: number | null;
    dueText?: string | null;
  },
) {
  return request('PUT', `/api/meetings/${meetingId}/agenda-board/${target}/${encodeURIComponent(itemId)}`, body);
}

/** REQ-093 [회의 끝내기] (회의록 작성자). 결론 나지 않은 안건 목록·오늘 회의 요약이 보드로 온다. 녹음은 마무리까지 이어진다 */
export function requestMeetingEnd(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/end-request`);
}

/** REQ-095 [이어서 논의하기]: 끝내기 요청을 거두고 회의를 이어 간다 */
export function cancelMeetingEnd(meetingId: number) {
  return request('DELETE', `/api/meetings/${meetingId}/end-request`);
}

/** REQ-094 고른 안건을 폴더의 남은 안건으로 넘긴다 (다음 회의에서 불러온다) */
export function carryOverAgendas(meetingId: number, agendaIds: number[]) {
  return request('POST', `/api/meetings/${meetingId}/carry-over`, { agendaIds });
}

/** REQ-089 줄마다 안건 */
export function listLineAgendas(meetingId: number) {
  return request<LineAgendaResponse[]>('GET', `/api/meetings/${meetingId}/line-agendas`);
}

/** REQ-089 줄의 안건 고치기 (회의록 작성자, 진행 중). agendaId null = 해당 없음 */
export function correctLineAgenda(meetingId: number, seq: number, agendaId: number | null) {
  return request<LineAgendaResponse>('PUT', `/api/meetings/${meetingId}/transcripts/${seq}/agenda`, { agendaId });
}

/** REQ-091~092 새 안건 제안 [무시]·주제 이탈 [확인] (회의록 작성자). 등록은 안건 추가로 한다 */
export function dismissOffTopic(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/off-topic/dismiss`);
}

/** 회의방 WebSocket 30초 1회용 입장권 (참석자) */
export async function issueRoomTicket(meetingId: number) {
  return (await request<TicketResponse>('POST', `/api/meetings/${meetingId}/room-ticket`)).ticket;
}

/** 음성(STT) WebSocket 30초 1회용 입장권 (회의록 작성자, 진행 중) */
export async function issueSttTicket(meetingId: number) {
  return (await request<TicketResponse>('POST', `/api/meetings/${meetingId}/stt-ticket`)).ticket;
}

/** REQ-018~020 홈 캘린더 항목 (취소된 회의 제외) */
export interface CalendarMeeting {
  meetingId: number;
  title: string;
  startAt: string;
  endAt: string;
  status: MeetingStatus;
  workspaceId: number;
  workspaceName: string;
  folderId: number;
  folderName: string;
}

/** REQ-018 from~to(2026-10-01, 하루 단위, 최대 42일) 사이에 내가 들어갈 수 있는 모든 폴더의 회의 */
export function listCalendarMeetings(from: string, to: string) {
  return request<CalendarMeeting[]>('GET', `/api/meetings/calendar?from=${from}&to=${to}`);
}
