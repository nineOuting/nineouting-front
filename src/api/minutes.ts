import type { Member } from '../types/meeting';
import { downloadFile, request } from './client';
import { toMember } from './meeting';

// minutes-service API (docs/services/minutes-service.md). 시각은 한국 시간 LocalDateTime 문자열

/** REQ-142 홈의 작성 중인 회의록 (내가 작성자, 회의 날짜가 오래된 순) */
export interface WritingMinutes {
  minutesId: number;
  meetingId: number;
  title: string;
  meetingStartAt: string;
  /** 없으면 빈 문자열 */
  location: string;
  workspaceId: number;
  workspaceName: string;
  folderId: number;
  folderName: string;
}

export function listWritingMinutes() {
  return request<WritingMinutes[]>('GET', '/api/users/me/writing-minutes');
}

type MinutesStatus = 'WRITING' | 'REVIEWING' | 'CONFIRMED';

interface PersonResponse {
  userId: number;
  name: string | null;
  profileImageUrl: string | null;
}

/** REQ-053 워크스페이스 아카이브 목록 항목 */
export interface ArchiveMinutes {
  minutesId: number;
  meetingId: number;
  title: string;
  meetingStartAt: string;
  location: string;
  status: MinutesStatus;
  folderId: number;
  folderName: string;
  attendees: Member[];
  favorite: boolean;
  important: boolean;
}

interface ArchivePageResponse {
  items: (Omit<ArchiveMinutes, 'attendees'> & { attendees: PersonResponse[] })[];
  page: number;
  size: number;
  totalCount: number;
  hasNext: boolean;
}

/** REQ-053~055, 145 검색 조건. 날짜는 2026-10-26 */
export interface ArchiveQuery {
  q: string;
  from?: string;
  to?: string;
  locations: string[];
  attendeeIds: number[];
  sort: 'LATEST' | 'OLDEST';
}

const ARCHIVE_PAGE_SIZE = 20;

/** REQ-053~055, 145 워크스페이스에서 내가 들어갈 수 있는 모든 폴더의 회의록 */
export async function listWorkspaceMinutes(workspaceId: number, query: ArchiveQuery, page: number) {
  const params = new URLSearchParams({ sort: query.sort, page: String(page), size: String(ARCHIVE_PAGE_SIZE) });
  if (query.q.trim()) {
    params.set('q', query.q.trim());
  }
  if (query.from) {
    params.set('from', query.from);
  }
  if (query.to) {
    params.set('to', query.to);
  }
  query.locations.forEach((location) => params.append('location', location));
  query.attendeeIds.forEach((attendeeId) => params.append('attendeeId', String(attendeeId)));
  const result = await request<ArchivePageResponse>('GET', `/api/workspaces/${workspaceId}/minutes?${params}`);
  return { ...result, items: result.items.map((item) => ({ ...item, attendees: item.attendees.map(toMember) })) };
}

/** REQ-055 장소 필터의 선택지 (가나다순) */
export function listMinutesLocations(workspaceId: number) {
  return request<string[]>('GET', `/api/workspaces/${workspaceId}/minutes/locations`);
}

/** REQ-146 워크스페이스에서 최근 본 회의록 */
export interface ViewedMinutes {
  minutesId: number;
  meetingId: number;
  title: string;
  meetingStartAt: string;
  viewedAt: string;
}

export function listViewedMinutes(workspaceId: number, size: number) {
  return request<ViewedMinutes[]>('GET', `/api/workspaces/${workspaceId}/viewed-minutes?size=${size}`);
}

/** REQ-146 회의록을 열 때마다 부른다 */
export function markMinutesViewed(minutesId: number) {
  return request('POST', `/api/minutes/${minutesId}/view`);
}

export const MINUTES_ERROR_CODES = {
  notReady: 'MINUTES_NOT_READY',
  versionConflict: 'MINUTES_VERSION_CONFLICT',
} as const;

export interface MinutesSection {
  /** 저장 전 새 칸이면 null */
  sectionId: number | null;
  title: string;
  content: string;
}

/** REQ-131~137 회의록 (작성 화면) */
export interface MinutesDetail {
  minutesId: number;
  meetingId: number;
  workspaceId: number;
  folderId: number;
  title: string;
  meetingStartAt: string;
  location: string;
  status: MinutesStatus;
  writer: Member;
  attendees: Member[];
  /** 아직 양식을 고르지 않았으면 null */
  templateId: number | null;
  /** 저장할 때 그대로 돌려보낸다 (다른 곳에서 먼저 저장했으면 거절) */
  version: number;
  sections: MinutesSection[];
}

type MinutesDetailResponse = Omit<MinutesDetail, 'writer' | 'attendees'> & {
  writer: PersonResponse;
  attendees: PersonResponse[];
};

function toMinutesDetail(response: MinutesDetailResponse): MinutesDetail {
  return {
    ...response,
    writer: toMember(response.writer),
    attendees: response.attendees.map(toMember),
    sections: response.sections.map(({ sectionId, title, content }) => ({ sectionId, title, content })),
  };
}

/** REQ-020 회의에서 회의록으로. 회의 마무리 직후 만들어지기 전이면 MINUTES_NOT_READY */
export async function getMinutesByMeeting(meetingId: number) {
  return toMinutesDetail(await request<MinutesDetailResponse>('GET', `/api/meetings/${meetingId}/minutes`));
}

/** REQ-135 임시저장 (작성자) */
export async function saveMinutesSections(minutesId: number, version: number, sections: MinutesSection[]) {
  return toMinutesDetail(
    await request<MinutesDetailResponse>('PUT', `/api/minutes/${minutesId}/sections`, { version, sections }),
  );
}

/** REQ-140 양식 변경 (작성자, 작성 중에만). 제목이 같은 칸의 내용은 남는다 */
export async function changeMinutesTemplate(minutesId: number, templateId: number) {
  return toMinutesDetail(
    await request<MinutesDetailResponse>('PUT', `/api/minutes/${minutesId}/template`, { templateId }),
  );
}

/** REQ-136 작성 완료: 참석 멤버에게 공유(검토 요청) */
export function shareMinutes(minutesId: number) {
  return request('POST', `/api/minutes/${minutesId}/review-request`);
}

export type ExportFormat = 'PDF' | 'DOCX';

/** REQ-137 회의록 다운로드 */
export async function downloadMinutes(minutesId: number, format: ExportFormat) {
  const { blob, fileName } = await downloadFile(`/api/minutes/${minutesId}/export?format=${format}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** REQ-119 회의록 양식 (기본 양식 + 내 양식) */
export interface MinutesTemplateInfo {
  templateId: number;
  name: string;
  isDefault: boolean;
  items: string[];
}

export function listMinutesTemplates() {
  return request<MinutesTemplateInfo[]>('GET', '/api/minutes-templates');
}
