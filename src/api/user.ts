import { getAccessToken } from '../auth/tokenStore';
import type { Member } from '../types/meeting';
import { request } from './client';

interface MyProfileResponse {
  userId: number;
  email: string;
  name: string;
  profileImageUrl: string | null;
}

export type Me = Member & { email: string };

let cached: { token: string | null; me: Promise<Me> } | null = null;

/** 로그인한 사용자. 회의록 작성자인지 등을 가릴 때 쓰고, 같은 로그인 동안은 한 번만 부른다 */
export function getMe() {
  const token = getAccessToken();
  if (!cached || cached.token !== token) {
    const me = request<MyProfileResponse>('GET', '/api/users/me').then(({ userId, email, name, profileImageUrl }) => ({
      userId,
      email,
      name,
      profileImageUrl: profileImageUrl ?? undefined,
    }));
    me.catch(() => {
      cached = null;
    });
    cached = { token, me };
  }
  return cached.me;
}

// user-service가 받는 사진 형식
export const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface WorkspaceProfile {
  name: string;
  affiliation: string;
  profileImageUrl?: string;
  /** 이 워크스페이스에서 따로 정했는지 (아니면 계정 프로필 값이다) */
  customName: boolean;
  customAffiliation: boolean;
  customProfileImage: boolean;
}

interface WorkspaceProfileResponse extends Omit<WorkspaceProfile, 'affiliation' | 'profileImageUrl'> {
  affiliation: string | null;
  profileImageUrl: string | null;
}

function toWorkspaceProfile(response: WorkspaceProfileResponse): WorkspaceProfile {
  return {
    name: response.name,
    affiliation: response.affiliation ?? '',
    profileImageUrl: response.profileImageUrl ?? undefined,
    customName: response.customName,
    customAffiliation: response.customAffiliation,
    customProfileImage: response.customProfileImage,
  };
}

const workspaceProfilePath = (workspaceId: number) => `/api/users/me/workspaces/${workspaceId}/profile`;

/** REQ-114·115·118 이 워크스페이스에서 보이는 내 프로필. 따로 정하지 않은 칸은 계정 프로필 값이다 */
export async function getWorkspaceProfile(workspaceId: number) {
  return toWorkspaceProfile(await request<WorkspaceProfileResponse>('GET', workspaceProfilePath(workspaceId)));
}

/** 보낸 칸만 바꾼다. 빈 문자열이면 계정 프로필 값으로 돌아간다 */
export async function updateWorkspaceProfile(workspaceId: number, changes: { name?: string; affiliation?: string }) {
  return toWorkspaceProfile(await request<WorkspaceProfileResponse>('PATCH', workspaceProfilePath(workspaceId), changes));
}

/** REQ-115 사진을 S3에 직접 올린 뒤 이 워크스페이스의 사진으로 등록한다 */
export async function uploadWorkspaceProfileImage(workspaceId: number, file: File) {
  const { uploadUrl, imageKey } = await request<{ uploadUrl: string; imageKey: string }>(
    'POST',
    '/api/users/me/profile-image/upload-url',
    { contentType: file.type },
  );
  const uploaded = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!uploaded.ok) {
    throw new Error(`profile image upload failed: ${uploaded.status}`);
  }
  return toWorkspaceProfile(
    await request<WorkspaceProfileResponse>('PUT', `${workspaceProfilePath(workspaceId)}/image`, { imageKey }),
  );
}

/** 이 워크스페이스의 사진을 지워 계정 사진으로 돌아간다 */
export async function deleteWorkspaceProfileImage(workspaceId: number) {
  return toWorkspaceProfile(await request<WorkspaceProfileResponse>('DELETE', `${workspaceProfilePath(workspaceId)}/image`));
}
