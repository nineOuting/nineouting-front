import type { Agenda, Meeting, MeetingStatus, Member, PendingAgenda } from '../types/meeting';
import type { FolderMeeting, FolderMeetingStatus, FolderPendingAgenda } from '../types/workspace';
import { request } from './client';

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

export type AgendaStatusCode = 'NOT_STARTED' | 'DISCUSSING' | 'DECIDED' | 'UNDECIDED';

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

/** REQ-073 회의 취소 */
export function cancelMeeting(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/cancel`);
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

/** REQ-084 회의 멈춤·재개 (회의록 작성자) */
export function pauseMeeting(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/pause`);
}

export function resumeMeeting(meetingId: number) {
  return request('POST', `/api/meetings/${meetingId}/resume`);
}

/** REQ-090 회의 도중 안건 추가 (회의록 작성자). 결정할 사항은 1개 이상 */
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

/** REQ-085 지금 회의 중 요약. 아직 없으면 null */
export function getLiveSummary(meetingId: number) {
  return request<LiveSummaryResponse | null>('GET', `/api/meetings/${meetingId}/live-summary`);
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
