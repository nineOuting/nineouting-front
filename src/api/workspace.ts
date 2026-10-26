import type { Member } from '../types/meeting';
import type {
  FolderAccess,
  FolderMember,
  FolderSummary,
  WorkspaceMember,
  WorkspaceSummary,
} from '../types/workspace';
import { request } from './client';

// workspace-service API (docs/services/workspace-service.md 4장)

export const WORKSPACE_ERROR_CODES = {
  folderNameDuplicated: 'FOLDER_NAME_DUPLICATED',
  ownerCannotLeave: 'OWNER_CANNOT_LEAVE',
  folderOwnerCannotLeave: 'FOLDER_OWNER_CANNOT_LEAVE',
} as const;

type WorkspaceRole = 'OWNER' | 'MEMBER';
type FolderAccessScope = 'ALL' | 'INVITED';

interface WorkspaceResponse {
  workspaceId: number;
  name: string;
  myRole: WorkspaceRole;
  lastVisited: boolean;
}

export interface WorkspaceDetail {
  workspaceId: number;
  name: string;
  isOwner: boolean;
  memberCount: number;
}

interface FolderNode {
  folderId: number;
  name: string;
  isDefault: boolean;
  ownerUserId: number | null;
  accessible: boolean;
}

interface MemberResponse {
  userId: number;
  name: string | null;
  email: string | null;
  profileImageUrl: string | null;
  role: WorkspaceRole;
  folderAccess: FolderAccessScope;
}

interface FolderMemberResponse {
  userId: number;
  name: string;
  email: string;
  profileImageUrl: string | null;
  owner: boolean;
  /** 초대가 아니라 "모든 폴더" 권한으로 들어오는 사람 (폴더에서 내보낼 수 없다) */
  inherited: boolean;
}

export interface FolderInfo {
  folderId: number;
  workspaceId: number;
  name: string;
  isDefault: boolean;
  isOwner: boolean;
}

const UNKNOWN_NAME = '알 수 없는 사용자';

const toAccess = (scope: FolderAccessScope): FolderAccess => (scope === 'ALL' ? 'all' : 'invited');

/** REQ-029 내가 참여 중인 워크스페이스 */
export async function listMyWorkspaces(): Promise<WorkspaceSummary[]> {
  const items = await request<WorkspaceResponse[]>('GET', '/api/workspaces');
  return items.map(({ workspaceId, name }) => ({ workspaceId, name }));
}

/** REQ-028 멤버만 들어올 수 있다 (아니면 403) */
export async function getWorkspace(workspaceId: number): Promise<WorkspaceDetail> {
  const detail = await request<{ workspaceId: number; name: string; myRole: WorkspaceRole; memberCount: number }>(
    'GET',
    `/api/workspaces/${workspaceId}`,
  );
  return {
    workspaceId: detail.workspaceId,
    name: detail.name,
    isOwner: detail.myRole === 'OWNER',
    memberCount: detail.memberCount,
  };
}

/** REQ-030 마지막으로 접속한 워크스페이스 기억 */
export function markLastVisited(workspaceId: number) {
  return request('PUT', `/api/workspaces/${workspaceId}/last-visited`);
}

/** REQ-138 워크스페이스 삭제 (소유자) */
export function deleteWorkspace(workspaceId: number) {
  return request('DELETE', `/api/workspaces/${workspaceId}`);
}

/** REQ-037 내가 들어갈 수 있는 프로젝트 폴더 (기본 폴더가 맨 위). 회의 수는 meeting-service에서 따로 받는다 */
export async function listFolders(workspaceId: number): Promise<Omit<FolderSummary, 'meetingCount'>[]> {
  const nodes = await request<FolderNode[]>('GET', `/api/workspaces/${workspaceId}/folders`);
  return nodes
    .filter(({ accessible }) => accessible)
    .map(({ folderId, name, isDefault }) => ({ folderId, name, isDefault }));
}

/** REQ-039~040 새 프로젝트 폴더 */
export function createFolder(workspaceId: number, name: string) {
  return request<FolderNode>('POST', `/api/workspaces/${workspaceId}/folders`, { name });
}

export function renameFolder(folderId: number, name: string) {
  return request<FolderNode>('PATCH', `/api/folders/${folderId}`, { name });
}

/** REQ-058 폴더 삭제 (폴더 소유자, 기본 폴더 불가) */
export function deleteFolder(folderId: number) {
  return request('DELETE', `/api/folders/${folderId}`);
}

/** REQ-033 워크스페이스 멤버 (소유자만 볼 수 있다) */
export async function listWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]> {
  const members = await request<MemberResponse[]>('GET', `/api/workspaces/${workspaceId}/members`);
  return members.map((member) => ({
    userId: member.userId,
    name: member.name ?? UNKNOWN_NAME,
    email: member.email ?? '',
    profileImageUrl: member.profileImageUrl ?? undefined,
    isOwner: member.role === 'OWNER',
    folderAccess: toAccess(member.folderAccess),
  }));
}

/** REQ-127 이메일로 초대. 받은 사람이 메일의 링크로 수락하면 멤버가 된다 */
export function inviteByEmail(workspaceId: number, email: string) {
  return request('POST', `/api/workspaces/${workspaceId}/invitations`, { email });
}

/** REQ-128 멤버별 폴더 접근 권한 (소유자) */
export function changeFolderAccess(workspaceId: number, userId: number, access: FolderAccess) {
  return request('PUT', `/api/workspaces/${workspaceId}/members/${userId}/folder-access`, {
    folderAccess: access === 'all' ? 'ALL' : 'INVITED',
  });
}

/** REQ-036 워크스페이스에서 제외 (소유자) */
export function removeWorkspaceMember(workspaceId: number, userId: number) {
  return request('DELETE', `/api/workspaces/${workspaceId}/members/${userId}`);
}

/** REQ-032 워크스페이스 나가기 (소유자는 OWNER_CANNOT_LEAVE) */
export function leaveWorkspace(workspaceId: number) {
  return request('DELETE', `/api/workspaces/${workspaceId}/members/me`);
}

/** REQ-038 폴더 열기 (최근 방문으로 기록된다) */
export async function getFolder(folderId: number): Promise<FolderInfo> {
  const detail = await request<FolderInfo & { ownerUserId: number | null }>('GET', `/api/folders/${folderId}`);
  return {
    folderId: detail.folderId,
    workspaceId: detail.workspaceId,
    name: detail.name,
    isDefault: detail.isDefault,
    isOwner: detail.isOwner,
  };
}

/** REQ-041 폴더 멤버 (소유자, 초대된 멤버, "모든 폴더" 권한으로 들어오는 멤버) */
export async function listFolderMemberDetails(folderId: number): Promise<FolderMember[]> {
  const members = await request<FolderMemberResponse[]>('GET', `/api/folders/${folderId}/members`);
  return members.map((member) => ({
    userId: member.userId,
    name: member.name,
    email: member.email,
    profileImageUrl: member.profileImageUrl ?? undefined,
    isOwner: member.owner,
    isInherited: member.inherited,
  }));
}

/** REQ-061 회의 참석자는 폴더에 들어갈 수 있는 사람 중에서 고른다 */
export async function listFolderMembers(folderId: number): Promise<Member[]> {
  const members = await listFolderMemberDetails(folderId);
  return members.map(({ userId, name, profileImageUrl }) => ({ userId, name, profileImageUrl }));
}

/** REQ-041 폴더에 멤버 초대 (폴더 소유자, 같은 워크스페이스 멤버만) */
export function addFolderMember(folderId: number, userId: number) {
  return request('POST', `/api/folders/${folderId}/members`, { userId });
}

/** REQ-042 폴더에서 제외 (폴더 소유자) */
export function removeFolderMember(folderId: number, userId: number) {
  return request('DELETE', `/api/folders/${folderId}/members/${userId}`);
}

/** REQ-139 폴더 나가기 (폴더 소유자는 FOLDER_OWNER_CANNOT_LEAVE) */
export function leaveFolder(folderId: number) {
  return request('DELETE', `/api/folders/${folderId}/members/me`);
}
