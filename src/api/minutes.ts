import type { Member } from '../types/meeting';
import type { ItemSettings, MinutesTemplate, TemplateLayout } from '../types/template';
import { documentType } from '../utils/documentTypes';
import { withItemDefaults, withLayoutDefaults } from '../utils/templateSettings';
import { downloadFile, putToStorage, request } from './client';
import { toMember } from './meeting';

// minutes-service API (docs/services/minutes-service.md). 시각은 한국 시간 LocalDateTime 문자열

/** REQ-149~150 홈의 작성 중인 회의록 (내가 작성자, 회의 날짜가 오래된 순) */
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

/** REQ-053~055, 029~030 검색 조건. 날짜는 2026-10-26 */
export interface ArchiveQuery {
  q: string;
  from?: string;
  to?: string;
  locations: string[];
  attendeeIds: number[];
  sort: 'LATEST' | 'OLDEST' | 'TITLE';
  /** 폴더 탭에서 고른 폴더. 없으면 전체 */
  folderId?: number;
}

/** REQ-168 한 페이지 10건 */
// 디자인 체크 2026-11-19: 목록은 5개까지, 나머지는 페이지 번호로 (REQ-168)
export const ARCHIVE_PAGE_SIZE = 5;

/** REQ-053~055, 029~030 워크스페이스에서 내가 들어갈 수 있는 모든 폴더의 회의록 */
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
  if (query.folderId !== undefined) {
    params.set('folderId', String(query.folderId));
  }
  const result = await request<ArchivePageResponse>('GET', `/api/workspaces/${workspaceId}/minutes?${params}`);
  return { ...result, items: result.items.map((item) => ({ ...item, attendees: item.attendees.map(toMember) })) };
}

/** 아카이브 폴더 탭의 회의록 수 (검색어, 필터와 상관없이 전체). 내가 들어갈 수 있는 폴더만 온다 */
export function listArchiveFolderCounts(workspaceId: number) {
  return request<{ folderId: number; minutesCount: number }[]>('GET', `/api/workspaces/${workspaceId}/minutes/folder-counts`);
}

/** REQ-055 장소 필터의 선택지 (가나다순) */
export function listMinutesLocations(workspaceId: number) {
  return request<string[]>('GET', `/api/workspaces/${workspaceId}/minutes/locations`);
}

/** REQ-159 워크스페이스에서 최근 본 회의록 */
export interface ViewedMinutes {
  minutesId: number;
  meetingId: number;
  title: string;
  meetingStartAt: string;
  viewedAt: string;
  folderId: number;
  folderName: string;
}

export function listViewedMinutes(workspaceId: number, size: number) {
  return request<ViewedMinutes[]>('GET', `/api/workspaces/${workspaceId}/viewed-minutes?size=${size}`);
}

/** REQ-159 회의록을 열 때마다 부른다 */
export function markMinutesViewed(minutesId: number) {
  return request('POST', `/api/minutes/${minutesId}/view`);
}

export const MINUTES_ERROR_CODES = {
  notReady: 'MINUTES_NOT_READY',
  versionConflict: 'MINUTES_VERSION_CONFLICT',
  draftInProgress: 'DRAFT_IN_PROGRESS',
} as const;

export interface MinutesSection {
  /** 저장 전 새 칸이면 null */
  sectionId: number | null;
  title: string;
  content: string;
  /** REQ-194 서식을 담은 HTML (줄글 칸). 없으면 null */
  richContent: string | null;
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
  /**
   * REQ-101 AI 초안. 양식을 처음 고르면 요청한다. 요청 전이면 null.
   * WAITING_SOURCE: 오늘 회의 요약을 기다리는 중 (오면 서버가 요청한다). REQUESTED와 함께 "만드는 중"
   */
  draftStatus: 'WAITING_SOURCE' | 'REQUESTED' | 'SUCCEEDED' | 'FAILED' | null;
  draftError: string | null;
  /** REQ-194 서식 기능이 켜져 있는지. 서버에서 끄면 예전처럼 서식 없는 입력 칸을 쓴다 */
  richText: boolean;
  /** 쓰는 양식의 레이아웃과 칸 설정. 내 양식 목록에 없는 다른 사람의 양식이어도 같은 모양으로 그린다. 양식이 없으면 null */
  template: MinutesTemplate | null;
}

type MinutesDetailResponse = Omit<MinutesDetail, 'writer' | 'attendees' | 'template'> & {
  writer: PersonResponse;
  attendees: PersonResponse[];
  template?: TemplateResponse | null;
};

function toMinutesDetail(response: MinutesDetailResponse): MinutesDetail {
  return {
    ...response,
    writer: toMember(response.writer),
    attendees: response.attendees.map(toMember),
    sections: response.sections.map(({ sectionId, title, content, richContent }) => ({
      sectionId,
      title,
      content,
      richContent: richContent ?? null,
    })),
    richText: response.richText ?? false,
    template: response.template ? toTemplate(response.template) : null,
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

/** REQ-161 AI 초안 다시 만들기 (작성자, 작성 중에만). 만드는 중이면 DRAFT_IN_PROGRESS */
export async function requestMinutesDraft(minutesId: number) {
  return toMinutesDetail(await request<MinutesDetailResponse>('POST', `/api/minutes/${minutesId}/draft`));
}

/** REQ-140 양식 변경 (작성자, 작성 중에만). 제목이 같은 칸의 내용은 남는다 */
export async function changeMinutesTemplate(minutesId: number, templateId: number) {
  return toMinutesDetail(
    await request<MinutesDetailResponse>('PUT', `/api/minutes/${minutesId}/template`, { templateId }),
  );
}

/** REQ-136 작성 완료: 바로 확정하고 참석 멤버에게 공유 (2026-10-28부터 검토 단계 없음) */
export function shareMinutes(minutesId: number) {
  return request('POST', `/api/minutes/${minutesId}/complete`);
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

type TemplateResponse = Omit<MinutesTemplate, 'items' | 'layout'> & {
  items: { title: string; description: string; settings: Partial<ItemSettings> }[];
  layout: Partial<TemplateLayout>;
};

function toTemplate(response: TemplateResponse): MinutesTemplate {
  return {
    ...response,
    items: response.items.map((item) => ({ ...item, settings: withItemDefaults(item.settings) })),
    layout: withLayoutDefaults(response.layout),
  };
}

/** REQ-119 회의록 양식 (기본 양식이 먼저, 그다음 내 양식) */
export async function listMinutesTemplates() {
  return (await request<TemplateResponse[]>('GET', '/api/minutes-templates')).map(toTemplate);
}

type TemplateRequest = Pick<MinutesTemplate, 'name' | 'description' | 'items' | 'layout'>;

/**
 * REQ-213 워크스페이스 기본 양식 정하기 (워크스페이스 소유자). 고른 양식을 워크스페이스 사본으로 만들어 기본 양식으로 정하고 그 사본을 돌려준다.
 * 원본을 고치거나 지워도 워크스페이스 기본 양식은 그대로다
 */
export async function setWorkspaceDefaultTemplate(workspaceId: number, templateId: number) {
  return toTemplate(
    await request<TemplateResponse>('PUT', `/api/minutes-templates/workspaces/${workspaceId}/default`, { templateId }),
  );
}

/** REQ-123 양식 즐겨찾기 등록·해제 (나만 보는 표시) */
export function setTemplateFavorite(templateId: number, favorite: boolean) {
  return request(favorite ? 'PUT' : 'DELETE', `/api/minutes-templates/${templateId}/favorite`);
}

/** REQ-120 새 양식 */
export async function createMinutesTemplate(template: TemplateRequest) {
  return toTemplate(await request<TemplateResponse>('POST', '/api/minutes-templates', template));
}

/** REQ-121 양식 편집 (내 양식만, 기본 양식은 고칠 수 없다) */
export async function updateMinutesTemplate(templateId: number, template: TemplateRequest) {
  return toTemplate(await request<TemplateResponse>('PUT', `/api/minutes-templates/${templateId}`, template));
}

/** REQ-121 양식 삭제 (이미 만든 회의록의 칸은 그대로) */
/**
 * REQ-157 양식 배경 이미지 올리기 (PNG, JPEG, WebP, 5MB 이하). 돌려준 imageKey를 layout.backgroundImageKey에 넣고 양식을 저장한다
 */
export async function uploadTemplateBackground(file: File) {
  const { imageKey, uploadUrl, contentType } = await request<{ imageKey: string; uploadUrl: string; contentType: string }>(
    'POST',
    '/api/minutes-templates/background-upload-url',
    { contentType: file.type, size: file.size },
  );
  await putToStorage(uploadUrl, file, contentType);
  return imageKey;
}

/** REQ-195 양식 가져오기 파일 크기 상한. 형식은 utils/documentTypes (서버와 AI가 파일 내용으로 다시 확인한다) */
export const TEMPLATE_IMPORT_MAX_BYTES = 20 * 1024 * 1024;

export interface TemplateImportStatus {
  importId: number;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  /** SUCCEEDED일 때 만든 양식 */
  templateId: number | null;
  /** FAILED일 때 이유 코드와 화면 문구 (문구는 임시, 기획에서 정하는 중) */
  code: string | null;
  message: string | null;
}

/**
 * REQ-195 양식 파일(PDF, Word, Excel, 텍스트)을 올리고 가져오기를 접수한다. 분석은 서버가 뒤에서 하고(최대 약 2분),
 * 결과는 getTemplateImport로 다시 묻는다
 */
export async function startTemplateImport(file: File, name: string) {
  const contentType = documentType(file) ?? file.type;
  const upload = await request<{ fileKey: string; uploadUrl: string; contentType: string }>(
    'POST',
    '/api/minutes-templates/import-upload-url',
    { contentType, size: file.size },
  );
  await putToStorage(upload.uploadUrl, file, upload.contentType);
  return request<TemplateImportStatus>('POST', '/api/minutes-templates/import', { fileKey: upload.fileKey, name });
}

export function getTemplateImport(importId: number) {
  return request<TemplateImportStatus>('GET', `/api/minutes-templates/import/${importId}`);
}

export function deleteMinutesTemplate(templateId: number) {
  return request('DELETE', `/api/minutes-templates/${templateId}`);
}

/** REQ-199 워크스페이스 기본 양식으로 정한 내 양식을 그 워크스페이스 멤버 모두 쓰게 한다 (끄면 공유를 거둔다) */
export function shareTemplateToWorkspace(templateId: number, workspaceId: number, shared: boolean) {
  return request(shared ? 'PUT' : 'DELETE', `/api/minutes-templates/${templateId}/workspace-shares/${workspaceId}`);
}
