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
  /** 폴더를 만든 사람 (기본 폴더는 없음). 폴더 메뉴를 보여 줄지 가린다 */
  ownerUserId?: number | null;
  /** REQ-202 프로젝트 색 번호 (0~7) */
  color?: number;
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
  /** 2026-10-24T14:00:00 (워크스페이스 폴더 카드의 다음 회의 시각) */
  startAt?: string;
  /** 예정 종료 시각. 시작하지 않은 채 지난 회의를 가려낸다 */
  endAt?: string;
  status: FolderMeetingStatus;
  writer: Member;
  attendees: Member[];
}

/** REQ-051 남은 안건 */
export interface FolderPendingAgenda {
  pendingAgendaId: number;
  title: string;
  fromMeetingTitle: string;
  /** 2026-10-20 */
  carriedAt: string;
  decisionPoints: string[];
  /** 다음 회의에 이미 불러왔으면 삭제할 수 없다 (MSG-089) */
  isTaken: boolean;
}

/** REQ-151 즐겨찾기한 워크스페이스·폴더 */
export type Favorite =
  | { type: 'workspace'; workspaceId: number; workspaceName: string; folderId?: undefined; folderName?: undefined }
  | { type: 'folder'; workspaceId: number; workspaceName: string; folderId: number; folderName: string; folderColor?: number };
