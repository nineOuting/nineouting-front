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
  /** 초대가 아니라 "모든 폴더" 권한으로 들어오는 멤버 (폴더에서 내보낼 수 없다) */
  isInherited?: boolean;
}

/** REQ-048 회의 목록의 상태: 예정 / 진행 중 / (회의록) 작성 중 / 검토 중 / 확정 */
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

/** REQ-143 즐겨찾기한 워크스페이스·폴더 */
export type Favorite =
  | { type: 'workspace'; workspaceId: number; workspaceName: string; folderId?: undefined; folderName?: undefined }
  | { type: 'folder'; workspaceId: number; workspaceName: string; folderId: number; folderName: string };
