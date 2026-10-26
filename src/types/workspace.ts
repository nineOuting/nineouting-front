import type { Member } from './meeting';

export interface WorkspaceSummary {
  workspaceId: number;
  name: string;
}

/** REQ-128 멤버별 폴더 접근 권한 */
export type FolderAccess = 'all' | 'invited';

export interface WorkspaceMember extends Member {
  email: string;
  isOwner: boolean;
  folderAccess: FolderAccess;
}

/** REQ-037 워크스페이스의 프로젝트 폴더 (기본 폴더는 맨 위) */
export interface FolderSummary {
  folderId: number;
  name: string;
  isDefault: boolean;
  meetingCount: number;
}

export interface FolderMember extends Member {
  email: string;
  isOwner: boolean;
}

/** REQ-048 회의 목록의 상태: 예정 / 진행 중 / 회의록 작성 중 / 검토 중 / 확정 */
export type FolderMeetingStatus = 'scheduled' | 'inProgress' | 'writing' | 'reviewing' | 'confirmed';

export interface FolderMeeting {
  meetingId: number;
  title: string;
  /** 2026-10-24 */
  date: string;
  status: FolderMeetingStatus;
  writer: Member & { affiliation?: string };
  attendees: Member[];
}

/** REQ-051 남은 안건 */
export interface FolderPendingAgenda {
  pendingAgendaId: number;
  title: string;
  fromMeetingTitle: string;
  /** 2026-10-20 */
  carriedAt: string;
}

export interface FolderDetail {
  folderId: number;
  workspaceId: number;
  workspaceName: string;
  name: string;
  isOwner: boolean;
  subFolders: FolderSummary[];
  meetings: FolderMeeting[];
  members: FolderMember[];
  pendingAgendas: FolderPendingAgenda[];
}
