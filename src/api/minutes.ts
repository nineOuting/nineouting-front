import type { Member } from '../types/meeting';
import { request } from './client';
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
