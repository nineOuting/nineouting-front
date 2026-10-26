import { request } from './client';

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
